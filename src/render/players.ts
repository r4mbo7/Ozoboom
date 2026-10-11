import { Container, type Sprite } from 'pixi.js';
import type { PlayerId, PlayerState, SimEvent, SimState } from '../sim/state';
import { MAIN_TEMPO, type Tempo } from '../shared/tempo';
import { createBurster } from './class-bursts';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { shadowAt } from './ground-sun';
import { createBagLook } from './look-bag';
import { createParasolLook } from './look-parasol';
import { createPoiLook } from './look-poi';
import { lerp } from './motion';
import { TAU } from './paint';
import type { Look, LookInput, Spawn } from './player-look';
import { PlayerTag, ReviveLog } from './player-tags';
import { PLAYER_LOOKS, type PlayerLook, REFERENCE } from './textures-players';
import { add, hide, lookup, setTint } from './util';
import { ViewPool } from './views';

const LOOKS: ReadonlyMap<string, PlayerLook> = new Map(Object.entries(PLAYER_LOOKS));
const TEINTS = [0xf1c9a5, 0xd9a07a, 0xa86f4c, 0x7a4a31];
const DOWNED_TINT = 0x8e8e98;
const CONTOUR_RING = 58;
const CONTOUR_MARGIN = 4;
const MAX_STEP_TICKS = 3;
const NEVER = Number.NEGATIVE_INFINITY;
const PLAYER_BURSTS = 48;

// The contour breathes on the beat, smoothly: never a flash.
export function contourAlpha(now: number, { ticksPerBeat }: Tempo = MAIN_TEMPO): number {
  const phase = (((now % ticksPerBeat) + ticksPerBeat) % ticksPerBeat) / ticksPerBeat;
  return 0.3 + 0.35 * (1 + Math.sin(phase * TAU));
}

function teintOf(player: PlayerState): number {
  return TEINTS[player.id % TEINTS.length] ?? 0xf1c9a5;
}

interface PlayerView {
  lastNow: number;
  moving: number;
  heading: number;
  readonly looks: Partial<Record<PlayerLook, Look>>;
  readonly halo: Sprite;
  readonly tag: PlayerTag;
  readonly shadow: Sprite;
  readonly lying: Sprite;
  readonly aim: Sprite;
  readonly contour: Sprite;
}

interface Moments {
  fired: number;
  fireCount: number;
  hit: number;
  skill: number;
}

export function createPlayers(ctx: RenderContext): Family {
  const { textures, layers } = ctx;
  const t = textures.players;
  const ground = layers.players.addChild(new Container());
  const bodies = layers.players.addChild(new Container());
  const marks = layers.players.addChild(new Container());
  const rings = layers.players.addChild(new Container());
  const tags = layers.players.addChild(new Container());
  const revives = new ReviveLog();
  const burster = createBurster(ctx, PLAYER_BURSTS);
  const spawn: Spawn = burster.spawn;
  const moments = new Map<PlayerId, Moments>();
  let beatTick = NEVER;
  let beatIndex = 0;

  const makers: Readonly<Record<PlayerLook, () => Look>> = {
    poi: () => createPoiLook(bodies, textures, spawn),
    bag: () => createBagLook(bodies, textures, spawn),
    parasol: () => createParasolLook(bodies, layers.glow, textures, spawn),
  };

  const views = new ViewPool(
    (): PlayerView => ({
      lastNow: NEVER,
      moving: 0,
      heading: 0,
      looks: {},
      halo: add(layers.glow, textures.halo),
      tag: new PlayerTag(ctx, rings, tags),
      shadow: add(ground, t.looks.poi.shadow),
      lying: add(bodies, t.looks.poi.downed),
      aim: add(marks, t.aim),
      contour: add(marks, t.contour),
    }),
    // A released view forgets its player, so that the next one starts from rest.
    (view) => {
      view.lastNow = NEVER;
      view.moving = 0;
      view.tag.hide();
      hide(view.halo, view.shadow, view.lying, view.aim, view.contour);
      for (const look of Object.values(view.looks)) {
        look.hide();
        look.reset();
      }
    },
  );

  const input: LookInput = {
    player: undefined as unknown as PlayerState,
    x: 0,
    y: 0,
    angle: 0,
    scale: 1,
    color: 0,
    teint: 0,
    frame: undefined as unknown as Frame,
    dt: 0,
    speed: 0,
    moving: 0,
    heading: 0,
    beatIndex: 0,
    sinceBeat: 0,
    fireCount: 0,
    sinceFire: Infinity,
    sinceHit: Infinity,
    sinceSkill: Infinity,
  };

  function momentsOf(id: PlayerId): Moments {
    let found = moments.get(id);
    if (found === undefined) {
      found = { fired: NEVER, fireCount: 0, hit: NEVER, skill: NEVER };
      moments.set(id, found);
    }
    return found;
  }

  return {
    onEvent(event: SimEvent, state: SimState): void {
      revives.onEvent(event, state.tick);
      switch (event.type) {
        case 'beat':
          beatTick = state.tick;
          beatIndex = event.beat;
          break;
        case 'playerFired': {
          const found = momentsOf(event.playerId);
          found.fired = state.tick;
          found.fireCount += 1;
          break;
        }
        case 'playerHit':
          momentsOf(event.playerId).hit = state.tick;
          break;
        case 'skillUsed':
          momentsOf(event.playerId).skill = state.tick;
          break;
        default:
          break;
      }
    },
    reset(): void {
      revives.clear();
      moments.clear();
      burster.bursts.clear();
      beatTick = NEVER;
      views.releaseAll();
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, light, pulse, now } = frame;
      const sun = shadowAt(frame.fraction);
      const sunX = Math.cos(sun.angle);
      const sunY = Math.sin(sun.angle);
      views.begin();
      for (const player of state.players) {
        const view = views.acquire(player.id);
        const color = palette[lookup(ctx.classTokens, player.classId, 'class')];
        const kind = lookup(LOOKS, player.classId, 'class look');
        const lookTextures = t.looks[kind];
        const x = lerp(player.prevX, player.x, alpha);
        const y = lerp(player.prevY, player.y, alpha);
        const scale = player.radius / REFERENCE;
        const angle = Math.atan2(player.aim.y, player.aim.x);
        const look = (view.looks[kind] ??= makers[kind]());
        const { halo, tag, shadow, lying, aim, contour } = view;

        const dazzled = (player.dazzledTicks ?? 0) > 0;
        const share = revives.share(player.id, player.downed, now);
        halo.visible = share > 0 || (!player.downed && !((player.suppressedTicks ?? 0) > 0));
        setTint(halo, dazzled ? palette.texte : color);
        halo.position.set(x, y);
        halo.scale.set(
          ((player.radius * (dazzled ? 4.6 : 3.2)) / textures.halo.radius) * (1 + 0.1 * pulse),
        );
        halo.alpha = dazzled ? Math.min(1, light.haloAlpha * 1.6) : light.haloAlpha;
        if (player.downed) {
          halo.scale.set(((player.radius * 2.6) / textures.halo.radius) * (1 + 0.1 * pulse));
          halo.alpha = light.haloAlpha * 0.8 * share;
        }

        tag.place(
          player,
          x,
          y,
          lookTextures.extent * scale * (player.downed ? 1.3 : 1),
          color,
          share,
          revives.burst(player.id, now),
          frame,
        );

        const downed = player.downed;
        const dt =
          view.lastNow === NEVER ? 0 : Math.min(MAX_STEP_TICKS, Math.max(0, now - view.lastNow));
        view.lastNow = now;
        const moved = Math.hypot(player.x - player.prevX, player.y - player.prevY);
        const speed = player.speed > 0 ? moved / player.speed : 0;
        if (moved > 1e-3) {
          view.heading = Math.atan2(player.y - player.prevY, player.x - player.prevX);
        }
        view.moving += ((speed > 0.15 ? 1 : 0) - view.moving) * (1 - Math.exp(-dt * 0.5));

        let lift = 0;
        lying.visible = downed;
        if (downed) {
          look.hide();
          hide(aim, contour);
          lying.texture = lookTextures.downed.texture;
          setTint(lying, DOWNED_TINT);
          lying.position.set(x, y);
          lying.rotation = angle;
          lying.scale.set(scale * 1.25);
          lying.alpha = 0.6 + 0.4 * pulse;
        } else {
          const moment = momentsOf(player.id);
          input.player = player;
          input.x = x;
          input.y = y;
          input.angle = angle;
          input.scale = scale;
          input.color = color;
          input.teint = teintOf(player);
          input.frame = frame;
          input.dt = dt;
          input.speed = speed;
          input.moving = view.moving;
          input.heading = view.heading;
          input.beatIndex = beatIndex;
          input.sinceBeat = now - beatTick;
          input.fireCount = moment.fireCount;
          input.sinceFire = now - moment.fired;
          input.sinceHit = now - moment.hit;
          input.sinceSkill = now - moment.skill;
          lift = look.place(input);
        }

        const reach = sun.length * (downed ? 1 : lookTextures.height * 3) + lift * 6 * scale;
        shadow.visible = true;
        shadow.texture = lookTextures.shadow.texture;
        setTint(shadow, 0x000000);
        shadow.alpha = sun.alpha * (downed ? 0.5 : 1);
        shadow.rotation = sun.angle - Math.PI / 2;
        shadow.position.set(x + sunX * reach, y + sunY * reach);
        const shrink = 1 - 0.14 * lift;
        shadow.scale.set(
          scale * (downed ? 0.6 : 1) * shrink,
          scale * (0.85 + 0.1 * sun.length) * shrink,
        );
        if (downed) {
          continue;
        }

        aim.visible = true;
        setTint(aim, color);
        const distance = (lookTextures.extent + 12) * scale;
        aim.position.set(x + player.aim.x * distance, y + player.aim.y * distance);
        aim.rotation = angle;
        aim.scale.set(scale);

        const invulnerable = (player.invulnerableTicks ?? 0) > 0;
        contour.visible = invulnerable;
        if (invulnerable) {
          setTint(contour, color);
          contour.position.set(x, y);
          contour.scale.set(((lookTextures.extent + CONTOUR_MARGIN) / CONTOUR_RING) * scale);
          contour.alpha = contourAlpha(now, frame.tempo);
        }
      }
      views.end();
      burster.bursts.update(state, alpha, frame);
    },
    destroy(): void {
      burster.bursts.clear();
      layers.players.destroy({ children: true });
    },
  };
}

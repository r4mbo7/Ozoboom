import { Container, type Sprite } from 'pixi.js';
import type { PlayerState, SimEvent, SimState } from '../sim/state';
import { MAIN_TEMPO, type Tempo, ticksIntoBeat } from '../shared/tempo';
import { createBurster } from './class-bursts';
import type { Family, RenderContext } from './context';
import { DashArc } from './dash-arc';
import { PlayerEmote } from './emotes';
import { LifeArc } from './life-arc';
import { MomentLog } from './player-moments';
import { createDashBursts } from './dash-bursts';
import { createDrawn } from './drawings';
import type { Frame } from './frame';
import { shadowAt } from './ground-sun';
import { lerp } from './motion';
import { TAU } from './paint';
import { Downed } from './player-downed';
import { PlayerGlow } from './player-glow';
import { type Look, type Spawn, createLookInput } from './player-look';
import { PlayerTag, ReviveLog } from './player-tags';
import { CONTOUR_RING, REFERENCE } from './textures-players';
import { DOWNED_REACH } from './textures-players-downed';
import { add, hide, lookup, setTint } from './util';
import { ViewPool } from './views';

const TEINTS = [0xf1c9a5, 0xd9a07a, 0xa86f4c, 0x7a4a31];
const CONTOUR_MARGIN = 4;
const MAX_STEP_TICKS = 3;
const NEVER = Number.NEGATIVE_INFINITY;
const PLAYER_BURSTS = 48;

// The contour breathes on the beat, smoothly: never a flash.
export function contourAlpha(now: number, tempo: Tempo = MAIN_TEMPO): number {
  const phase = ticksIntoBeat(now, tempo) / tempo.ticksPerBeat;
  return 0.3 + 0.35 * (1 + Math.sin(phase * TAU));
}

function teintOf(player: PlayerState): number {
  return TEINTS[player.id % TEINTS.length] ?? 0xf1c9a5;
}

interface PlayerView {
  lastNow: number;
  moving: number;
  heading: number;
  readonly looks: Map<string, Look>;
  readonly halo: Sprite;
  readonly glow: PlayerGlow;
  readonly tag: PlayerTag;
  readonly shadow: Sprite;
  readonly lying: Downed;
  readonly aim: Sprite;
  readonly contour: Sprite;
  readonly dashArc: DashArc;
  readonly lifeArc: LifeArc;
  readonly emote: PlayerEmote;
}

export function createPlayers(ctx: RenderContext): Family {
  const { textures, layers } = ctx;
  const t = textures.players;
  const ground = layers.players.addChild(new Container());
  const bodies = layers.players.addChild(new Container());
  const marks = layers.players.addChild(new Container());
  const tags = layers.players.addChild(new Container());
  const lifeLabels = layers.players.addChild(new Container());
  const gestures = layers.players.addChild(new Container());
  const revives = new ReviveLog();
  const burster = createBurster(ctx, PLAYER_BURSTS);
  const spawn: Spawn = burster.spawn;
  const moments = new MomentLog();
  let beatTick = NEVER;
  let beatIndex = 0;

  const drawnOf = createDrawn(textures, bodies, layers.glow, spawn);

  const views = new ViewPool(
    (): PlayerView => ({
      lastNow: NEVER,
      moving: 0,
      heading: 0,
      looks: new Map(),
      halo: add(layers.glow, textures.halo),
      glow: new PlayerGlow(ctx, marks),
      tag: new PlayerTag(ctx, tags),
      shadow: add(ground, t.looks.poi.shadow),
      lying: new Downed(ctx, bodies, marks),
      aim: add(marks, t.aim),
      contour: add(marks, t.contour),
      dashArc: new DashArc(ground),
      lifeArc: new LifeArc(ctx, ground, lifeLabels),
      emote: new PlayerEmote(ctx, gestures),
    }),
    // A released view forgets its player, so that the next one starts from rest.
    (view) => {
      view.lastNow = NEVER;
      view.moving = 0;
      view.tag.hide();
      view.glow.reset();
      view.dashArc.reset();
      view.lifeArc.reset();
      view.emote.reset();
      hide(view.halo, view.shadow, view.aim, view.contour);
      view.lying.hide();
      for (const look of view.looks.values()) {
        look.hide();
        look.reset?.();
      }
    },
  );

  const input = createLookInput();

  const dashBursts = createDashBursts(
    ctx,
    spawn,
    (player) => drawnOf(player.classId).textures.extent * (player.radius / REFERENCE),
  );

  return {
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      revives.onEvent(event, state.tick);
      switch (event.type) {
        case 'beat':
          beatTick = state.tick;
          beatIndex = event.beat;
          break;
        case 'playerFired': {
          const found = moments.of(event.playerId);
          found.fired = state.tick;
          found.fireCount += 1;
          break;
        }
        case 'playerHit':
          moments.of(event.playerId).hit = state.tick;
          break;
        case 'skillUsed':
          moments.of(event.playerId).skill = state.tick;
          break;
        case 'pickupCollected':
          views.peek(event.playerId)?.glow.collect(state.tick, frame.tempo);
          break;
        case 'dashed':
        case 'dashBack':
          dashBursts.onEvent(event, state, frame);
          break;
        case 'emoted':
          views.peek(event.playerId)?.emote.begin(event.emote, state.tick);
          break;
        case 'dashEmpty':
          views.peek(event.playerId)?.dashArc.empty(state.tick);
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
        const { textures: lookTextures, make } = drawnOf(player.classId);
        const color = palette[lookup(ctx.classTokens, player.classId, 'class')];
        const x = lerp(player.prevX, player.x, alpha);
        const y = lerp(player.prevY, player.y, alpha);
        const scale = player.radius / REFERENCE;
        const angle = Math.atan2(player.aim.y, player.aim.x);
        let look = view.looks.get(player.classId);
        if (look === undefined) {
          look = make();
          view.looks.set(player.classId, look);
        }
        const { halo, tag, shadow, lying, aim, contour } = view;
        const dazzled = (player.dazzledTicks ?? 0) > 0;
        const share = revives.share(player.id, player.downed, now);
        const burst = revives.burst(player.id, now);
        halo.visible = share > 0 || (!player.downed && !((player.suppressedTicks ?? 0) > 0));
        setTint(halo, dazzled ? palette.texte : color);
        halo.position.set(x, y);
        halo.scale.set(
          ((player.radius * (dazzled ? 4.6 : 3.2)) / textures.halo.radius) * (1 + 0.1 * pulse),
        );
        const kept = 1 - (frame.drained.players.get(player.id) ?? 0);
        halo.alpha = (dazzled ? Math.min(1, light.haloAlpha * 1.6) : light.haloAlpha) * kept;
        if (player.downed) {
          halo.scale.set(((player.radius * 2.6) / textures.halo.radius) * (1 + 0.1 * pulse));
          halo.alpha = light.haloAlpha * 0.8 * share * kept;
        }

        const top = tag.place(
          player,
          x,
          y,
          player.downed
            ? DOWNED_REACH * scale
            : Math.max(lookTextures.extent * scale, view.lifeArc.extent(player, frame)),
          color,
          burst,
          frame,
          state.players.length > 1,
        );
        const downed = player.downed;
        const bounce = view.glow.place(player, x, y, lookTextures.extent * scale, frame);
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
        lying.place(downed, x, y, angle, scale, color, share, burst, frame);
        if (downed) {
          look.hide();
          hide(aim, contour);
          view.emote.reset();
        } else {
          view.emote.place(x, y, angle, scale, top, color, teintOf(player), frame);
          const moment = moments.of(player.id);
          input.state = state;
          input.player = player;
          input.x = x;
          input.y = y;
          input.angle = angle;
          input.scale = scale * bounce;
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

        view.dashArc.place(player, x, y, color, ctx.dash, frame);
        view.lifeArc.place(player, x, y, color, now - moments.of(player.id).hit, frame);

        // Lying flat, an outline of light casts no shadow.
        shadow.visible = !downed;
        if (downed) {
          continue;
        }
        const reach = sun.length * lookTextures.height * 3 + lift * 6 * scale;
        shadow.texture = lookTextures.shadow.texture;
        setTint(shadow, 0x000000);
        shadow.alpha = sun.alpha;
        shadow.rotation = sun.angle - Math.PI / 2;
        shadow.position.set(x + sunX * reach, y + sunY * reach);
        const shrink = 1 - 0.14 * lift;
        shadow.scale.set(scale * shrink, scale * (0.85 + 0.1 * sun.length) * shrink);

        aim.visible = lookTextures.aimless !== true;
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

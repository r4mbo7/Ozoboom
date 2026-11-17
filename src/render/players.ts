import { Container, type Sprite } from 'pixi.js';
import { clamp, lerp } from '../shared/scalar';
import type { SimEvent, SimState } from '../sim/state';
import { MAIN_TEMPO, type Tempo, ticksIntoBeat } from '../shared/tempo';
import { PlayerCarriedTraps } from './carried-traps';
import { createBurster } from './class-bursts';
import type { Family, RenderContext } from './context';
import { DashArc } from './dash-arc';
import { PlayerEmote } from './emotes';
import { shadowAt } from './ground-sun';
import { LifeArc } from './life-arc';
import { MomentLog } from './player-moments';
import { createDashBursts } from './dash-bursts';
import { createDrawn } from './drawings';
import type { Frame } from './frame';
import { TAU } from './paint';
import { PotionBodies, PoweredBody } from './potion-aura-model';
import { Downed } from './player-downed';
import { PlayerGlow } from './player-glow';
import { placePlayerHalo } from './player-halo';
import { type Look, type LookInput, type Spawn, createLookInput, teintOf } from './player-look';
import { placePlayerShadow } from './player-shadow';
import { PlayerTag, ReviveLog } from './player-tags';
import { CONTOUR_RING, REFERENCE_RADIUS } from './textures-players';
import { DOWNED_REACH } from './textures-players-downed';
import { add, hide, lookup, setTint } from './util';
import { ViewPool } from './views';

const CONTOUR_MARGIN = 4;
const MAX_STEP_TICKS = 3;
const NEVER = Number.NEGATIVE_INFINITY;
const PLAYER_BURSTS = 48;

// Smoothly: never a flash.
export function contourAlpha(now: number, tempo: Tempo = MAIN_TEMPO): number {
  const phase = ticksIntoBeat(now, tempo) / tempo.ticksPerBeat;
  return 0.3 + 0.35 * (1 + Math.sin(phase * TAU));
}

interface PlayerView {
  lastNow: number;
  moving: number;
  heading: number;
  readonly looks: Map<string, Look>;
  readonly powered: PoweredBody;
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
  readonly carried: PlayerCarriedTraps;
}

export function createPlayers(ctx: RenderContext): Family & { readonly potion: PotionBodies } {
  const { textures, layers } = ctx;
  const t = textures.players;
  // The arcs over the potion's flames, to stay readable.
  const under = layers.players.addChild(new Container());
  const ground = under.addChild(new Container());
  const potion = new PotionBodies(under.addChild(new Container()));
  const arcs = under.addChild(new Container());
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

  const drawnOf = createDrawn(textures, layers.glow, spawn);

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
      powered: new PoweredBody(bodies.addChild(new Container())),
      aim: add(marks, t.aim),
      contour: add(marks, t.contour),
      dashArc: new DashArc(arcs, () => ctx.options.tutorialCall?.gesture === 'dash'),
      lifeArc: new LifeArc(ctx, arcs, lifeLabels),
      emote: new PlayerEmote(ctx, gestures, ground),
      carried: new PlayerCarriedTraps(ctx),
    }),
    (view) => {
      view.lastNow = NEVER;
      view.moving = 0;
      view.tag.hide();
      view.glow.reset();
      view.dashArc.reset();
      view.lifeArc.reset();
      view.emote.reset();
      hide(view.halo, view.shadow, view.aim, view.contour);
      view.carried.hide();
      view.lying.hide();
      for (const look of view.looks.values()) {
        look.hide();
        look.reset?.();
      }
    },
  );

  let input: LookInput | null = null;

  const dashBursts = createDashBursts(
    ctx,
    spawn,
    (player) => drawnOf(player.classId).textures.extent * (player.radius / REFERENCE_RADIUS),
  );

  return {
    potion,
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
        case 'carriedTrapWornOut':
        case 'trapTaken':
          views.peek(event.playerId)?.carried.onEvent(event, state.tick);
          break;
        case 'batteryTaken':
          for (const { id } of state.players) {
            views.peek(id)?.carried.renew(state.tick);
          }
          break;
        case 'dashEmpty':
          views.peek(event.playerId)?.dashArc.empty(state.tick);
          break;
      }
    },
    reset(): void {
      revives.clear();
      moments.clear();
      burster.bursts.clear();
      beatTick = NEVER;
      potion.powered.length = 0;
      views.releaseAll();
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      const { palette, now } = frame;
      const sun = shadowAt(frame.fraction);
      views.begin();
      potion.powered.length = 0;
      for (const player of state.players) {
        const view = views.acquire(player.id);
        const { textures: lookTextures, make } = drawnOf(player.classId);
        const color = palette[lookup(ctx.classTokens, player.classId, 'class')];
        const x = lerp(player.prevX, player.x, alpha);
        const y = lerp(player.prevY, player.y, alpha);
        const scale = player.radius / REFERENCE_RADIUS;
        const angle = Math.atan2(player.aim.y, player.aim.x);
        let look = view.looks.get(player.classId);
        if (look === undefined) {
          look = make(view.powered.body);
          view.looks.set(player.classId, look);
        }
        const { halo, tag, shadow, lying, aim, contour } = view;
        const share = revives.share(player.id, player.downed, now);
        const burst = revives.burst(player.id, now);
        placePlayerHalo(halo, textures.halo.radius, player, x, y, color, share, frame);

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
        view.carried.place(player, x, top, frame);
        const bounce = view.glow.place(player, x, y, lookTextures.extent * scale, frame);
        const dt = view.lastNow === NEVER ? 0 : clamp(now - view.lastNow, 0, MAX_STEP_TICKS);
        view.lastNow = now;
        const moved = Math.hypot(player.x - player.prevX, player.y - player.prevY);
        const speed = player.speed > 0 ? moved / player.speed : 0;
        if (moved > 1e-3) {
          view.heading = Math.atan2(player.y - player.prevY, player.x - player.prevX);
        }
        view.moving += ((speed > 0.15 ? 1 : 0) - view.moving) * (1 - Math.exp(-dt * 0.5));

        let lift = 0;
        lying.place(player.downed, x, y, angle, scale, color, share, burst, frame);
        if (player.downed) {
          look.hide();
          hide(aim, contour);
          view.emote.reset();
        } else {
          const { cover } = lookTextures;
          view.emote.place(x, y, angle, scale, top, color, teintOf(player), cover, frame);
          const moment = moments.of(player.id);
          input ??= createLookInput(state, player, frame);
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
          potion.expose(view.powered, input, lookTextures.extent * scale);
        }

        view.dashArc.place(player, x, y, color, ctx.dash, frame);
        view.lifeArc.place(player, x, y, color, now - moments.of(player.id).hit, frame);

        shadow.visible = !player.downed;
        if (player.downed) {
          continue;
        }
        placePlayerShadow(shadow, sun, lookTextures, x, y, scale, lift);

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

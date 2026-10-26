import type { Container } from 'pixi.js';
import { clamp01, lerp } from '../shared/scalar';
import type { Vec2 } from '../shared/vec';
import type { EntityId, SimState } from '../sim/state';
import type { Frame } from './frame';
import { easeInOutCubic, easeOutCubic } from './motion';
import { SHADE_DEEP, WHITE, circle, paint, type Shape } from './paint';
import { mixColor } from './palette';
import { lerpAngle } from './player-look';
import { add, byId, hide, setTint } from './util';

const RISE_BEATS = 0.15;
const SWEEP_BEATS = 1.5;
const FOLLOW_BEATS = 4;
const FADE_BEATS = 1;
const CALM_FILL_BEATS = 1;
const LAST_BEAT = SWEEP_BEATS + FOLLOW_BEATS + FADE_BEATS;

const BEAM = { length: 256, lens: 3, end: 28 };
const POOL = { size: 128, reach: 1.6 };
const HEAD = { rim: 1.28, size: 0.32 };
const LIGHT = { night: 0.42, day: 0.4, warmth: 0.6, white: 0xffffff };

export interface Spot {
  readonly aim: number;
  readonly reach: number;
  readonly light: number;
}

interface Polar {
  readonly aim: number;
  readonly reach: number;
}

function polar(from: Vec2, to: Vec2): Polar {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return { aim: Math.atan2(dy, dx), reach: Math.hypot(dx, dy) };
}

// The stage's followspot leaves the team on the 1 of the drop, sweeps to the boss and follows it a
// bar. In calm mode it does not sweep: it fills from the core toward where the boss landed.
export function spotOf(
  beats: number,
  core: Vec2,
  team: Vec2,
  boss: { readonly landed: Vec2; readonly now: Vec2 },
  calm: boolean,
): Spot | null {
  if (beats < 0 || beats >= LAST_BEAT) {
    return null;
  }
  const light = Math.min(clamp01(beats / RISE_BEATS), clamp01((LAST_BEAT - beats) / FADE_BEATS));
  if (calm) {
    const landed = polar(core, boss.landed);
    const fill = easeOutCubic(clamp01(beats / CALM_FILL_BEATS));
    return { aim: landed.aim, reach: landed.reach * fill, light };
  }
  const from = polar(core, team);
  const to = polar(core, boss.now);
  const share = easeInOutCubic(clamp01(beats / SWEEP_BEATS));
  return {
    aim: lerpAngle(from.aim, to.aim, share),
    reach: lerp(from.reach, to.reach, share),
    light,
  };
}

// Where the team stands, interpolated like the players: the camera may sit far from them, clamped at
// the arena's edge or following one player online.
export function teamCenter(
  players: readonly {
    readonly prevX: number;
    readonly x: number;
    readonly prevY: number;
    readonly y: number;
  }[],
  core: Vec2,
  between: number,
): Vec2 {
  if (players.length === 0) {
    return { x: core.x, y: core.y };
  }
  let x = 0;
  let y = 0;
  for (const player of players) {
    x += lerp(player.prevX, player.x, between);
    y += lerp(player.prevY, player.y, between);
  }
  return { x: x / players.length, y: y / players.length };
}

interface Looks {
  readonly beam: Shape;
  readonly pool: Shape;
  readonly head: Shape;
}

function paintLooks(): Looks {
  return {
    beam: paint(BEAM.length, 2 * BEAM.end + 4, BEAM.length, (ctx) => {
      ctx.translate(-BEAM.length / 2, 0);
      for (const [spread, alpha] of [
        [1, 0.45],
        [0.55, 0.75],
      ] as const) {
        const light = ctx.createLinearGradient(0, 0, BEAM.length, 0);
        light.addColorStop(0, `rgb(255 255 255 / ${String(alpha)})`);
        light.addColorStop(1, `rgb(255 255 255 / ${String(alpha * 0.45)})`);
        ctx.beginPath();
        ctx.moveTo(0, -BEAM.lens);
        ctx.lineTo(BEAM.length, -BEAM.end * spread);
        ctx.lineTo(BEAM.length, BEAM.end * spread);
        ctx.lineTo(0, BEAM.lens);
        ctx.closePath();
        ctx.fillStyle = light;
        ctx.fill();
      }
    }),
    pool: paint(POOL.size, POOL.size, POOL.size / 2, (ctx) => {
      const light = ctx.createRadialGradient(0, 0, 0, 0, 0, POOL.size / 2);
      light.addColorStop(0, WHITE);
      light.addColorStop(0.55, 'rgb(255 255 255 / 0.55)');
      light.addColorStop(1, 'rgb(255 255 255 / 0)');
      circle(ctx, POOL.size / 2);
      ctx.fillStyle = light;
      ctx.fill();
    }),
    head: paint(48, 40, 16, (ctx) => {
      ctx.beginPath();
      ctx.roundRect(-14, -11, 24, 22, 6);
      ctx.fillStyle = SHADE_DEEP;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = WHITE;
      ctx.stroke();
      circle(ctx, 6, 10, 0);
      ctx.fillStyle = WHITE;
      ctx.fill();
    }),
  };
}

export interface BossSpotlight {
  land(id: EntityId, at: Vec2, tick: number): void;
  update(state: SimState, frame: Frame): void;
  reset(): void;
  destroy(): void;
}

export function createBossSpotlight(light: Container, rig: Container): BossSpotlight {
  const looks = paintLooks();
  const beam = add(light, looks.beam, 0);
  const pool = add(light, looks.pool);
  const head = add(rig, looks.head);
  let landing: { id: EntityId; at: Vec2; tick: number } | null = null;

  function show(spot: Spot, state: SimState, frame: Frame, radius: number): void {
    const { core } = state;
    const cos = Math.cos(spot.aim);
    const sin = Math.sin(spot.aim);
    const lens = core.radius * HEAD.rim;
    const reach = Math.max(spot.reach, lens);
    const night = frame.light.additive;
    const tint = night ? mixColor(LIGHT.white, frame.palette.or, LIGHT.warmth) : frame.palette.or;
    const alpha = (night ? LIGHT.night : LIGHT.day) * spot.light;
    const poolRadius = radius * POOL.reach;

    beam.position.set(core.x + cos * lens, core.y + sin * lens);
    beam.rotation = spot.aim;
    beam.scale.set((reach - lens) / BEAM.length, poolRadius / BEAM.end);
    pool.position.set(core.x + cos * reach, core.y + sin * reach);
    pool.scale.set(poolRadius / (POOL.size / 2));
    for (const sprite of [beam, pool]) {
      sprite.visible = true;
      sprite.alpha = alpha;
      setTint(sprite, tint);
    }
    head.visible = true;
    head.alpha = spot.light;
    head.position.set(beam.position.x, beam.position.y);
    head.rotation = spot.aim;
    head.scale.set((core.radius * HEAD.size) / looks.head.radius);
  }

  return {
    land(id, at, tick): void {
      landing = { id, at, tick };
    },
    update(state, frame): void {
      const boss = landing === null ? undefined : byId(state.enemies, landing.id);
      const between = frame.now - state.tick;
      const spot =
        landing === null || boss === undefined
          ? null
          : spotOf(
              (frame.now - landing.tick) / frame.tempo.ticksPerBeat,
              state.core,
              teamCenter(state.players, state.core, between),
              {
                landed: landing.at,
                now: { x: lerp(boss.prevX, boss.x, between), y: lerp(boss.prevY, boss.y, between) },
              },
              frame.calm,
            );
      if (spot === null || boss === undefined) {
        landing = null;
        hide(beam, pool, head);
        return;
      }
      show(spot, state, frame, boss.radius);
    },
    reset(): void {
      landing = null;
      hide(beam, pool, head);
    },
    destroy(): void {
      for (const sprite of [beam, pool, head]) {
        sprite.destroy();
      }
      for (const look of [looks.beam, looks.pool, looks.head]) {
        look.texture.destroy(true);
      }
    },
  };
}

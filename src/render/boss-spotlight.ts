import { Container, type Sprite } from 'pixi.js';
import { clamp01, lerp } from '../shared/scalar';
import type { Vec2 } from '../shared/vec';
import type { EntityId, SimState } from '../sim/state';
import type { Frame } from './frame';
import { easeInOutCubic, easeOutCubic } from './motion';
import { SHADE_DEEP, WHITE, circle, paint, type Shape } from './paint';
import { mixColor } from './palette';
import { lerpAngle } from './player-look';
import { add, byId, hide, setTint } from './util';
import { ViewPool } from './views';

const RISE_BEATS = 0.15;
const SWEEP_BEATS = 1.5;
const FULL_BEATS = SWEEP_BEATS + 4;
const SETTLE_BEATS = 1;
const WATCH = 0.5;
const FADE_BEATS = 1;
const CALM_FILL_BEATS = 1;

const BEAM = { length: 256, lens: 3, end: 28 };
const POOL = { size: 128, reach: 1.6 };
const HEAD = { rim: 1.28, size: 0.32, glow: 0.9 };
const LIGHT = { night: 0.85, day: 0.55, warmth: 0.6, white: 0xffffff, glow: 0.7 };

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

// The stage's followspot leaves the team on the 1 of the drop, sweeps to the boss, follows it in
// full light for a bar, then settles to a watch light for as long as it lives and goes out over a
// beat once it is chased (`gone` counts the beats since, on the show clock: the sim waits for the
// relic choice meanwhile). In calm mode it does not sweep: it fills from the core toward the boss.
export function spotOf(
  beats: number,
  core: Vec2,
  team: Vec2,
  boss: Vec2,
  calm: boolean,
  gone: number | null,
): Spot | null {
  if (beats < 0 || (gone !== null && gone >= FADE_BEATS)) {
    return null;
  }
  const settled = lerp(1, WATCH, easeInOutCubic(clamp01((beats - FULL_BEATS) / SETTLE_BEATS)));
  const out = gone === null ? 1 : 1 - gone / FADE_BEATS;
  const light = Math.min(clamp01(beats / RISE_BEATS), settled) * out;
  const to = polar(core, boss);
  if (calm) {
    return { aim: to.aim, reach: to.reach * easeOutCubic(clamp01(beats / CALM_FILL_BEATS)), light };
  }
  const from = polar(core, team);
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
  readonly glow: Shape;
}

function paintLooks(): Looks {
  return {
    // Nested cones, dense at the lens and thinning along the throw, soft at the edges.
    beam: paint(BEAM.length, 2 * BEAM.end + 4, BEAM.length, (ctx) => {
      ctx.translate(-BEAM.length / 2, 0);
      for (const [spread, alpha] of [
        [1, 0.18],
        [0.78, 0.24],
        [0.55, 0.28],
        [0.3, 0.32],
      ] as const) {
        const light = ctx.createLinearGradient(0, 0, BEAM.length, 0);
        light.addColorStop(0, `rgb(255 255 255 / ${String(alpha)})`);
        light.addColorStop(0.2, `rgb(255 255 255 / ${String(alpha * 0.5)})`);
        light.addColorStop(0.8, `rgb(255 255 255 / ${String(alpha * 0.33)})`);
        light.addColorStop(1, `rgb(255 255 255 / ${String(alpha * 0.2)})`);
        ctx.beginPath();
        ctx.moveTo(0, -BEAM.lens * spread);
        ctx.lineTo(BEAM.length, -BEAM.end * spread);
        ctx.lineTo(BEAM.length, BEAM.end * spread);
        ctx.lineTo(0, BEAM.lens * spread);
        ctx.closePath();
        ctx.fillStyle = light;
        ctx.fill();
      }
    }),
    // A warm white heart and a soft, round edge.
    pool: paint(POOL.size, POOL.size, POOL.size / 2, (ctx) => {
      const light = ctx.createRadialGradient(0, 0, 0, 0, 0, POOL.size / 2);
      light.addColorStop(0, 'rgb(255 250 235 / 0.72)');
      light.addColorStop(0.35, 'rgb(255 238 205 / 0.46)');
      light.addColorStop(0.68, 'rgb(255 224 175 / 0.26)');
      light.addColorStop(0.8, 'rgb(255 214 150 / 0.1)');
      light.addColorStop(1, 'rgb(255 214 150 / 0)');
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
    glow: paint(96, 96, 48, (ctx) => {
      const light = ctx.createRadialGradient(0, 0, 0, 0, 0, 48);
      light.addColorStop(0, 'rgb(255 255 255 / 0.6)');
      light.addColorStop(0.35, 'rgb(255 255 255 / 0.22)');
      light.addColorStop(1, 'rgb(255 255 255 / 0)');
      circle(ctx, 48);
      ctx.fillStyle = light;
      ctx.fill();
    }),
  };
}

interface Followspot {
  readonly beam: Sprite;
  readonly pool: Sprite;
  readonly glow: Sprite;
  readonly head: Sprite;
}

interface Followed {
  readonly id: EntityId;
  x: number;
  y: number;
  radius: number;
  readonly landedTick: number;
  goneShow: number | null;
}

export interface BossSpotlight {
  land(id: EntityId, at: Vec2, tick: number): void;
  chased(id: EntityId, show: number): void;
  update(state: SimState, frame: Frame): void;
  reset(): void;
  destroy(): void;
}

// One followspot per boss alive, lit from its own lyre on the core's rim.
export function createBossSpotlight(light: Container, rig: Container): BossSpotlight {
  const looks = paintLooks();
  const lights = new Container();
  const heads = new Container();
  light.addChild(lights);
  rig.addChild(heads);
  const followed: Followed[] = [];
  const views = new ViewPool<Followspot>(
    () => ({
      beam: add(lights, looks.beam, 0),
      pool: add(lights, looks.pool),
      glow: add(lights, looks.glow),
      head: add(heads, looks.head),
    }),
    (view) => {
      hide(view.beam, view.pool, view.glow, view.head);
    },
  );

  function show(view: Followspot, spot: Spot, state: SimState, frame: Frame, radius: number): void {
    const { core } = state;
    const cos = Math.cos(spot.aim);
    const sin = Math.sin(spot.aim);
    const lens = core.radius * HEAD.rim;
    const reach = Math.max(spot.reach, lens);
    const night = frame.light.additive;
    const tint = night ? mixColor(LIGHT.white, frame.palette.or, LIGHT.warmth) : frame.palette.or;
    const alpha = (night ? LIGHT.night : LIGHT.day) * spot.light;
    const poolRadius = radius * POOL.reach;
    const { beam, pool, glow, head } = view;

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
    glow.visible = true;
    glow.alpha = LIGHT.glow * spot.light;
    glow.position.set(beam.position.x, beam.position.y);
    glow.scale.set((core.radius * HEAD.glow) / looks.glow.radius);
    setTint(glow, frame.palette.noyau);
    head.visible = true;
    head.alpha = spot.light;
    head.position.set(beam.position.x, beam.position.y);
    head.rotation = spot.aim;
    head.scale.set((core.radius * HEAD.size) / looks.head.radius);
  }

  return {
    land(id, at, tick): void {
      followed.push({ id, x: at.x, y: at.y, radius: 0, landedTick: tick, goneShow: null });
    },
    chased(id, show): void {
      const chase = byId(followed, id);
      if (chase !== undefined) {
        chase.goneShow ??= show;
      }
    },
    update(state, frame): void {
      const between = frame.now - state.tick;
      const { ticksPerBeat } = frame.tempo;
      const team = teamCenter(state.players, state.core, between);
      views.begin();
      let kept = 0;
      for (const chase of followed) {
        const boss = byId(state.enemies, chase.id);
        if (boss === undefined) {
          chase.goneShow ??= frame.show;
        } else {
          chase.x = lerp(boss.prevX, boss.x, between);
          chase.y = lerp(boss.prevY, boss.y, between);
          chase.radius = boss.radius;
        }
        const beats = (frame.now - chase.landedTick) / ticksPerBeat;
        const gone = chase.goneShow === null ? null : (frame.show - chase.goneShow) / ticksPerBeat;
        const spot = spotOf(beats, state.core, team, chase, frame.calm, gone);
        if (spot === null) {
          continue;
        }
        followed[kept] = chase;
        kept += 1;
        show(views.acquire(chase.id), spot, state, frame, chase.radius);
      }
      followed.length = kept;
      views.end();
    },
    reset(): void {
      followed.length = 0;
      views.releaseAll();
    },
    destroy(): void {
      lights.destroy({ children: true });
      heads.destroy({ children: true });
      for (const look of [looks.beam, looks.pool, looks.head, looks.glow]) {
        look.texture.destroy(true);
      }
    },
  };
}

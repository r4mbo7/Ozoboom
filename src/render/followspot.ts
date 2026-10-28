import { Container, type Sprite } from 'pixi.js';
import { lerp } from '../shared/scalar';
import type { Vec2 } from '../shared/vec';
import type { SimState } from '../sim/state';
import type { Frame } from './frame';
import { SHADE_DEEP, WHITE, circle, paint, type Shape } from './paint';
import { mixColor } from './palette';
import { add, hide, setTint } from './util';
import { ViewPool } from './views';

const BEAM = { length: 256, lens: 3, end: 28 };
const POOL = { size: 128 };
const HEAD = { rim: 1.28, size: 0.32, glow: 0.9 };
const LIGHT = { warmth: 0.6, white: 0xffffff, glow: 0.7 };

// How bright a beam and its pool are, by night and by day.
export interface Brightness {
  readonly night: number;
  readonly day: number;
}

export interface Spot {
  readonly aim: number;
  readonly reach: number;
  readonly light: number;
}

export interface Polar {
  readonly aim: number;
  readonly reach: number;
}

export function polar(from: Vec2, to: Vec2): Polar {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return { aim: Math.atan2(dy, dx), reach: Math.hypot(dx, dy) };
}

// Where the team stands, interpolated like the players: the camera may sit far from them, clamped at
// the arena's edge or following one player online. A player whose peer left stays where they were,
// so they no longer count.
export function teamCenter(
  players: readonly {
    readonly prevX: number;
    readonly x: number;
    readonly prevY: number;
    readonly y: number;
    readonly gone?: boolean;
  }[],
  core: Vec2,
  between: number,
): Vec2 {
  const present = players.filter((player) => player.gone !== true);
  if (present.length === 0) {
    return { x: core.x, y: core.y };
  }
  let x = 0;
  let y = 0;
  for (const player of present) {
    x += lerp(player.prevX, player.x, between);
    y += lerp(player.prevY, player.y, between);
  }
  return { x: x / present.length, y: y / present.length };
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

export interface Followspots {
  begin(): void;
  // `key` names one followspot from frame to frame; `pool` is the radius of its light where it lands.
  show(key: number, spot: Spot, state: SimState, frame: Frame, pool: number): void;
  end(): void;
  reset(): void;
  destroy(): void;
}

// The stage's followspots: each a beam from its own lyre on the core's rim to a pool of light.
export function createFollowspots(
  light: Container,
  rig: Container,
  brightness: Brightness,
): Followspots {
  const looks = paintLooks();
  const lights = new Container();
  const heads = new Container();
  light.addChild(lights);
  rig.addChild(heads);
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

  return {
    begin(): void {
      views.begin();
    },
    show(key, spot, state, frame, poolRadius): void {
      const { core } = state;
      const cos = Math.cos(spot.aim);
      const sin = Math.sin(spot.aim);
      const lens = core.radius * HEAD.rim;
      const reach = Math.max(spot.reach, lens);
      const night = frame.light.additive;
      const tint = night ? mixColor(LIGHT.white, frame.palette.or, LIGHT.warmth) : frame.palette.or;
      const alpha = (night ? brightness.night : brightness.day) * spot.light;
      const { beam, pool, glow, head } = views.acquire(key);

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
    },
    end(): void {
      views.end();
    },
    reset(): void {
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

import { Container, Graphics, type Sprite } from 'pixi.js';
import type { SetDefinition } from '../data/types';
import type { PaletteToken } from '../shared/palette';
import { nextFloat, seedRng, type RngState } from '../shared/prng';
import { setTempo } from '../sim/lineup';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { type GiantLayout, type Point, layGiants } from './giants-layout';
import { add, setTint } from './util';

const TAU = Math.PI * 2;
const WHITE = 0xffffff;
const SCALE = 10 / 9;
const SHOULDER = { x: 398, y: 32 };
const HAND_REACH = 467;
const OUTLINE = 4;
const INK = 0x1a1020;
const COLORS: readonly PaletteToken[] = ['mage', 'turquoise', 'or', 'healer', 'tank'];
const CORNERS: readonly Point[] = [
  { x: 90, y: 250 },
  { x: 90, y: 650 },
  { x: 1110, y: 250 },
  { x: 1110, y: 650 },
];
const DAY_ALPHA = 0.85;

interface Mushroom {
  readonly cap: Graphics;
  readonly halo: Sprite;
  readonly token: PaletteToken;
  readonly size: number;
  readonly phase: number;
}

interface Giant {
  readonly token: PaletteToken;
  readonly lit: Container;
  readonly dark: Container;
}

// A giant seen from above in the mock-up's units, its back to the core: the head's cap and ears, the torso, the roots.
// `extra` widens every line for the dark outline of the day, which has no fill.
function traceBody(g: Graphics, extra: number): void {
  const fill = extra === 0;
  g.moveTo(462, -64)
    .bezierCurveTo(510, -66, 545, -36, 545, 0)
    .bezierCurveTo(545, 36, 510, 66, 462, 64)
    .bezierCurveTo(454, 30, 454, -30, 462, -64)
    .closePath();
  g.stroke({ width: 3 + extra, color: WHITE, cap: 'round', join: 'round' });
  if (fill) {
    g.fill({ color: WHITE, alpha: 0.16 });
  }
  g.moveTo(468, -48)
    .bezierCurveTo(504, -48, 527, -26, 527, 0)
    .bezierCurveTo(527, 26, 504, 48, 468, 48);
  g.moveTo(472, -30)
    .bezierCurveTo(492, -30, 507, -16, 507, 0)
    .bezierCurveTo(507, 16, 492, 30, 472, 30);
  g.stroke({ width: 1.3 + extra, color: WHITE, cap: 'round' });
  g.ellipse(440, 0, 21, 18).stroke({ width: 2.4 + extra, color: WHITE });
  if (fill) {
    g.ellipse(440, 0, 21, 18).fill({ color: WHITE, alpha: 0.22 });
    for (const [x, y, r] of [
      [514, -28, 5],
      [520, 20, 4],
      [490, -6, 3.5],
    ] as const) {
      g.circle(x, y, r).fill({ color: WHITE, alpha: 0.5 });
    }
    g.circle(457, 0, 2.6).fill(WHITE);
    for (const x of [385, 364, 345]) {
      g.circle(x, 0, 3).fill(WHITE);
    }
  }
  g.moveTo(420, -10)
    .bezierCurveTo(412, -12, 410, -30, 398, -32)
    .bezierCurveTo(372, -36, 352, -24, 332, -18)
    .lineTo(332, 18)
    .bezierCurveTo(352, 24, 372, 36, 398, 32)
    .bezierCurveTo(410, 30, 412, 12, 420, 10);
  g.stroke({ width: 2.4 + extra, color: WHITE, cap: 'round', join: 'round' });
  if (fill) {
    g.fill({ color: WHITE, alpha: 0.14 });
  }
  for (const [y, endY] of [
    [-14, -48],
    [-4, -12],
    [6, 18],
    [14, 46],
  ] as const) {
    g.moveTo(332, y).bezierCurveTo(318, (y + endY) / 2, 310, endY * 0.85, 297, endY);
  }
  g.stroke({ width: 1.8 + extra, color: WHITE, cap: 'round' });
}

function armPoints(layout: GiantLayout, center: Point, arm: 0 | 1): Point[] {
  const { stones } = layout.arms[arm];
  const cos = Math.cos(layout.angle);
  const sin = Math.sin(layout.angle);
  const y = (arm === 0 ? -1 : 1) * SHOULDER.y;
  const shoulder = {
    x: center.x + (SHOULDER.x * cos - y * sin) * SCALE,
    y: center.y + (SHOULDER.x * sin + y * cos) * SCALE,
  };
  const last = stones.at(-1);
  if (last === undefined) {
    return [shoulder];
  }
  const axis = Math.round(Math.atan2(last.y - center.y, last.x - center.x) / (TAU / 4)) * (TAU / 4);
  const hand = {
    x: center.x + Math.cos(axis) * HAND_REACH * SCALE,
    y: center.y + Math.sin(axis) * HAND_REACH * SCALE,
  };
  return [shoulder, ...stones, hand];
}

// A curve through the middles of the segments: it passes close to every stone, and a stone it hides still blocks.
function strokeArm(g: Graphics, points: readonly Point[], width: number): void {
  const [first, ...rest] = points;
  if (first === undefined) {
    return;
  }
  g.moveTo(first.x, first.y);
  rest.forEach((point, index) => {
    const next = rest[index + 1];
    if (next === undefined) {
      g.lineTo(point.x, point.y);
    } else {
      g.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
    }
  });
  g.stroke({ width, color: WHITE, cap: 'round', join: 'round' });
}

// The four giants of the Dome, backs to the stage: their arms run along the arm stones and their joined hands close
// the ring over the four entrances, with mushroom clusters glowing around them. Drawn once, tinted with the hour:
// by night the lines are additive, by day they wear a dark outline. The caps pulse on the set's beat, still in the
// calm mode.
export function createGiants(ctx: RenderContext, sets: readonly SetDefinition[]): Family {
  const sources = new Map(sets.map((set) => [set.id, set]));
  const root = new Container();
  root.visible = false;
  ctx.layers.ground.addChild(root);
  let giants: Giant[] = [];
  let mushrooms: Mushroom[] = [];
  let caps = new Container();
  let halos = new Container();
  let drawnKey = '';
  let styledAt = Number.NaN;
  let styledAdditive: boolean | null = null;

  function mushroom(x: number, y: number, size: number, token: PaletteToken, rng: RngState) {
    const cap = new Graphics();
    cap.circle(0, 0, size).fill(WHITE);
    cap.circle(0, 0, size).stroke({ width: 1, color: INK, alpha: 0.35 });
    cap.circle(0, 0, size * 0.55).stroke({ width: 0.8, color: WHITE, alpha: 0.35 });
    cap.position.set(x, y);
    caps.addChild(cap);
    const halo = add(halos, ctx.textures.halo);
    halo.position.set(x, y);
    mushrooms.push({ cap, halo, token, size, phase: nextFloat(rng) * TAU });
  }

  function cluster(c: Point, count: number, spread: number, rng: RngState) {
    for (let index = 0; index < count; index += 1) {
      mushroom(
        c.x + (nextFloat(rng) - 0.5) * spread * SCALE,
        c.y + (nextFloat(rng) - 0.5) * spread * SCALE,
        (4 + nextFloat(rng) * 9) * SCALE,
        COLORS[Math.floor(nextFloat(rng) * COLORS.length)] ?? 'or',
        rng,
      );
    }
  }

  function draw(state: SimState, set: SetDefinition): void {
    for (const child of root.removeChildren()) {
      child.destroy({ children: true });
    }
    mushrooms = [];
    caps = new Container();
    halos = new Container();
    halos.blendMode = 'add';
    const center = { x: state.arena.width / 2, y: state.arena.height / 2 };
    const rng = seedRng((state.seed + 7919) >>> 0);
    const layout = layGiants(set.obstacles ?? [], center);
    giants = layout.map((giant, index) => {
      const lit = new Container();
      const dark = new Container();
      for (const [target, extra, color] of [
        [dark, OUTLINE, INK],
        [lit, 0, WHITE],
      ] as const) {
        const body = new Graphics();
        traceBody(body, extra);
        body.position.set(center.x, center.y);
        body.rotation = giant.angle;
        body.scale.set(SCALE);
        const arms = new Graphics();
        for (const arm of [0, 1] as const) {
          const points = armPoints(giant, center, arm);
          strokeArm(arms, points, 3 + extra);
          for (const stone of giant.arms[arm].stones) {
            arms.circle(stone.x, stone.y, stone.radius * 0.45);
          }
          const hand = points.at(-1);
          if (hand !== undefined && points.length > 1) {
            arms.circle(hand.x, hand.y, 6 + extra / 2);
          }
        }
        arms.fill({ color: WHITE, alpha: extra === 0 ? 0.35 : 1 });
        for (const part of [body, arms]) {
          part.tint = color;
          target.addChild(part);
        }
      }
      return { token: COLORS[index] ?? 'or', lit, dark };
    });
    root.addChild(...giants.map(({ dark }) => dark), ...giants.map(({ lit }) => lit), caps, halos);
    for (const giant of layout) {
      for (const offset of [-24, 24]) {
        const angle = giant.angle + (offset * Math.PI) / 180;
        const at = {
          x: center.x + Math.cos(angle) * 372 * SCALE,
          y: center.y + Math.sin(angle) * 372 * SCALE,
        };
        cluster(at, 3, 30, rng);
      }
    }
    for (const corner of CORNERS) {
      const at = { x: center.x + (corner.x - 600) * SCALE, y: center.y + (corner.y - 450) * SCALE };
      cluster(at, 4, 60, rng);
    }
    styledAt = Number.NaN;
    styledAdditive = null;
  }

  function style(frame: Frame): void {
    const { additive } = frame.light;
    styledAt = frame.fraction;
    if (additive !== styledAdditive) {
      styledAdditive = additive;
      for (const { lit, dark } of giants) {
        lit.blendMode = additive ? 'add' : 'normal';
        lit.alpha = additive ? 1 : DAY_ALPHA;
        dark.visible = !additive;
      }
      halos.alpha = additive ? 1 : 0.5;
    }
    for (const { token, lit } of giants) {
      for (const part of lit.children) {
        setTint(part, frame.palette[token]);
      }
    }
  }

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      const set = sources.get(state.setId);
      root.visible = ctx.decors.get(state.setId) === 'dome' && set !== undefined;
      if (!root.visible || set === undefined) {
        return;
      }
      const key = `${String(state.arena.width)}x${String(state.arena.height)}:${String(state.seed)}:${state.setId}`;
      if (key !== drawnKey) {
        drawnKey = key;
        draw(state, set);
      }
      if (frame.fraction !== styledAt || frame.light.additive !== styledAdditive) {
        style(frame);
      }
      const beat = setTempo(set).ticksPerBeat;
      for (const { cap, halo, token, size, phase } of mushrooms) {
        const glow = frame.calm ? 1 : 0.75 + 0.25 * Math.sin((frame.now / beat) * Math.PI + phase);
        setTint(cap, frame.palette[token]);
        setTint(halo, frame.palette[token]);
        halo.alpha = 0.4 * glow;
        halo.scale.set((size * 4.4 * (0.9 + 0.1 * glow)) / 128);
      }
    },
    destroy(): void {
      // The ground layer owns root and destroys it with its children.
    },
  };
}

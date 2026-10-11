import { Container, Graphics, type Sprite } from 'pixi.js';
import type { SetDefinition } from '../data/types';
import type { PaletteToken } from '../shared/palette';
import { nextFloat, seedRng, type RngState } from '../shared/prng';
import { setTempo } from '../sim/lineup';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { type Point, SCALE, armPath, layGiants } from './giants-layout';
import { traceBody, traceThrough } from './giants-body';
import { add, setTint } from './util';

const TAU = Math.PI * 2;
const WHITE = 0xffffff;
const INK = 0x1a1020;
const CREAM = 0xfffaeb;
const COLORS: readonly PaletteToken[] = ['mage', 'turquoise', 'or', 'healer', 'tank'];
const CORNERS: readonly Point[] = [
  { x: 90, y: 250 },
  { x: 90, y: 650 },
  { x: 1110, y: 250 },
  { x: 1110, y: 650 },
];
const DAY_ALPHA = 0.9;
const HAND = 6 * SCALE;
const KNOT_HALO = 46;

interface Mushroom {
  readonly cap: Graphics;
  readonly halo: Sprite;
  readonly token: PaletteToken;
  readonly size: number;
  readonly phase: number;
}

interface Giant {
  readonly token: PaletteToken;
  readonly lines: Container;
  readonly bands: Graphics;
  readonly knots: readonly Sprite[];
}

// The four giants of the Dome, backs to the stage: their arms are soft bands as wide as the arm stones, and their
// joined hands glow over the four entrances, with mushroom clusters around them. Drawn once, tinted with the hour:
// additive by night, see-through by day. The caps pulse on the set's beat, still in the calm mode.
export function createGiants(ctx: RenderContext, sets: readonly SetDefinition[]): Family {
  const sources = new Map(sets.map((set) => [set.id, set]));
  const root = new Container();
  root.visible = false;
  ctx.layers.ground.addChild(root);
  let giants: Giant[] = [];
  let mushrooms: Mushroom[] = [];
  let shadows = new Graphics();
  let caps = new Container();
  let spots = new Graphics();
  let halos = new Container();
  let drawnKey = '';
  let styledAt = Number.NaN;
  let styledAdditive: boolean | null = null;

  function mushroom(x: number, y: number, size: number, token: PaletteToken, rng: RngState) {
    shadows.circle(x + size * 0.25, y + size * 0.3, size);
    const cap = new Graphics();
    cap.circle(0, 0, size).fill(WHITE);
    cap.circle(0, 0, size).stroke({ width: 1, color: INK, alpha: 0.35 });
    cap.position.set(x, y);
    caps.addChild(cap);
    spots.circle(x, y, size * 0.55).stroke({ width: 0.8, color: WHITE, alpha: 0.35 });
    for (let spot = 0; spot < 4; spot += 1) {
      const angle = nextFloat(rng) * TAU;
      const reach = nextFloat(rng) * size * 0.7;
      spots
        .circle(
          x + Math.cos(angle) * reach,
          y + Math.sin(angle) * reach,
          size * (0.12 + nextFloat(rng) * 0.12),
        )
        .fill({ color: CREAM, alpha: 0.85 });
    }
    const halo = add(halos, ctx.textures.halo);
    halo.position.set(x, y);
    mushrooms.push({ cap, halo, token, size, phase: nextFloat(rng) * TAU });
  }

  function cluster(c: Point, spread: number, rng: RngState) {
    const count = 3 + Math.floor(nextFloat(rng) * 3);
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
    shadows = new Graphics();
    caps = new Container();
    spots = new Graphics();
    halos = new Container();
    halos.blendMode = 'add';
    const center = { x: state.arena.width / 2, y: state.arena.height / 2 };
    const rng = seedRng((state.seed + 7919) >>> 0);
    const layout = layGiants(set.obstacles ?? [], center);
    giants = layout.map((giant, index) => {
      const lines = new Container();
      const body = new Graphics();
      traceBody(body);
      body.position.set(center.x, center.y);
      body.rotation = giant.angle;
      body.scale.set(SCALE);
      const bands = new Graphics();
      const arms = new Graphics();
      const knots: Sprite[] = [];
      for (const arm of [0, 1] as const) {
        const { points, underTorso } = armPath(giant, center, arm);
        const width = 2 * Math.max(...giant.arms[arm].stones.map(({ radius }) => radius), 0);
        traceThrough(bands, points);
        bands.stroke({ width, color: WHITE, alpha: 0.17, cap: 'round', join: 'round' });
        for (const stone of underTorso) {
          bands.circle(stone.x, stone.y, stone.radius).fill({ color: WHITE, alpha: 0.17 });
        }
        traceThrough(arms, points);
        arms.stroke({ width: 2.4 * SCALE, color: WHITE, cap: 'round', join: 'round' });
        const hand = points.at(-1);
        const wrist = points.at(-2);
        if (hand !== undefined && wrist !== undefined) {
          const away = Math.hypot(wrist.x - hand.x, wrist.y - hand.y) || 1;
          const x = hand.x + ((wrist.x - hand.x) / away) * HAND * 0.6;
          const y = hand.y + ((wrist.y - hand.y) / away) * HAND * 0.6;
          arms.circle(x, y, HAND).fill(WHITE);
          arms.circle(x, y, HAND * 1.9).stroke({ width: 1.2, color: WHITE, alpha: 0.6 });
          const knot = add(halos, ctx.textures.halo);
          knot.position.set(hand.x, hand.y);
          knot.scale.set(KNOT_HALO / 64);
          knots.push(knot);
        }
      }
      lines.addChild(bands, body, arms);
      return { token: COLORS[index] ?? 'or', lines, bands, knots };
    });
    shadows.fill({ color: 0x000000, alpha: 0.28 });
    root.addChild(...giants.map(({ lines }) => lines), shadows, caps, spots, halos);
    for (const giant of layout) {
      for (const offset of [-24, 24]) {
        const angle = giant.angle + (offset * Math.PI) / 180;
        const at = {
          x: center.x + Math.cos(angle) * 372 * SCALE,
          y: center.y + Math.sin(angle) * 372 * SCALE,
        };
        cluster(at, 30, rng);
      }
    }
    for (const corner of CORNERS) {
      const at = { x: center.x + (corner.x - 600) * SCALE, y: center.y + (corner.y - 450) * SCALE };
      cluster(at, 60, rng);
    }
    styledAt = Number.NaN;
    styledAdditive = null;
  }

  function style(frame: Frame): void {
    const { additive } = frame.light;
    styledAt = frame.fraction;
    if (additive !== styledAdditive) {
      styledAdditive = additive;
      for (const { lines, bands } of giants) {
        lines.blendMode = additive ? 'add' : 'normal';
        lines.alpha = additive ? 1 : DAY_ALPHA;
        bands.alpha = additive ? 0.65 : 1;
      }
      halos.alpha = additive ? 1 : 0.5;
    }
    for (const { token, lines, knots } of giants) {
      for (const part of [...lines.children, ...knots]) {
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
      for (const { knots } of giants) {
        for (const knot of knots) {
          knot.alpha = frame.calm ? 0.35 : 0.3 + 0.1 * Math.sin((frame.now / beat) * Math.PI);
        }
      }
    },
    destroy(): void {
      // The ground layer owns root and destroys it with its children.
    },
  };
}

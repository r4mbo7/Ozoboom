import type { Graphics } from 'pixi.js';
import type { SetDefinition } from '../data/types';
import { nextFloat, type RngState } from '../shared/prng';
import { clamp01, lerp, smoothstep } from '../shared/scalar';
import { shoreAt, shoreOf } from '../sim/shore';
import type { Arena, SimState, Vec2 } from '../sim/state';
import type { Tree } from './ground-layout';
import { TAU } from './paint';
import type { PixiPalette } from './palette';

// Each stage's bearing from the core; on a lake set, the one west of it stands north, on the shore.
export const STAGES = [
  { token: 'turquoise', angle: -2.4, ashore: -1.55 },
  { token: 'mage', angle: -0.35, ashore: -0.35 },
  { token: 'or', angle: 0.75, ashore: 0.75 },
] as const;
export const STAGE = {
  near: 2000,
  far: 2800,
  spread: 0.5,
  radius: 260,
  disc: 110,
  glow: 900,
  shore: 420,
};
// The paths start past the arena's edge, which the game's view never leaves: none of the festival
// shows in it once landed.
const PATH = { width: 70, alpha: 0.55, bend: 0.25, margin: 80, steps: 48, fade: 0.35 };
const TREES = { count: 34, near: 1500, far: 3400, radius: 28, spread: 20, clear: 520, shore: 60 };

export interface Site {
  readonly stages: { x: number; y: number; token: (typeof STAGES)[number]['token'] }[];
  readonly trees: Tree[];
}

// The share of the way from `from` along (dx, dy) where it leaves the arena.
function leaving(arena: Arena, from: Vec2, dx: number, dy: number): number {
  const across = (at: number, d: number, size: number) =>
    d === 0 ? Number.POSITIVE_INFINITY : ((d > 0 ? size : 0) - at) / d;
  return Math.min(across(from.x, dx, arena.width), across(from.y, dy, arena.height));
}

// A path from past the arena's edge to a stage, coming out of the ground as it leaves the arena.
function drawPath(site: Graphics, arena: Arena, core: Vec2, stage: Vec2, color: number): void {
  const dx = stage.x - core.x;
  const dy = stage.y - core.y;
  const out = leaving(arena, core, dx, dy) + PATH.margin / Math.hypot(dx, dy);
  const from = { x: core.x + dx * out, y: core.y + dy * out };
  const bend = { x: core.x + dx / 2 + dy * PATH.bend, y: core.y + dy / 2 - dx * PATH.bend };
  const at = (share: number): Vec2 => ({
    x: lerp(lerp(from.x, bend.x, share), lerp(bend.x, stage.x, share), share),
    y: lerp(lerp(from.y, bend.y, share), lerp(bend.y, stage.y, share), share),
  });
  let last = from;
  for (let step = 1; step <= PATH.steps; step += 1) {
    const share = step / PATH.steps;
    const next = at(share);
    site
      .moveTo(last.x, last.y)
      .lineTo(next.x, next.y)
      .stroke({
        width: PATH.width,
        color,
        alpha: PATH.alpha * smoothstep(clamp01(share / PATH.fade)),
        cap: step === PATH.steps ? 'round' : 'butt',
      });
    last = next;
  }
}

// The festival around the arena, seen from the sky while the entry lasts, on the arena's own ground
// and lake, which go on under it: the other stages with their beams down curved paths, and trees
// drawn as the arena's, none in the water.
export function drawSite(
  site: Graphics,
  rng: RngState,
  state: SimState,
  set: SetDefinition,
  palette: PixiPalette,
): Site {
  const { core } = state;
  const shore = shoreOf(set, state.seed);
  site.clear();
  const stages = STAGES.map(({ token, angle, ashore }) => {
    const turn = (shore === null ? angle : ashore) + (nextFloat(rng) - 0.5) * STAGE.spread;
    const distance = STAGE.near + nextFloat(rng) * (STAGE.far - STAGE.near);
    const y = core.y + Math.sin(turn) * distance * 0.8;
    const x = core.x + Math.cos(turn) * distance;
    return {
      x: shore === null ? x : Math.max(x, shoreAt(shore, y) + STAGE.radius + STAGE.shore),
      y,
      token,
    };
  });
  for (const stage of stages) {
    drawPath(site, set.arena, core, stage, palette.solClair);
  }
  for (const stage of stages) {
    site
      .circle(stage.x, stage.y, STAGE.radius)
      .fill({ color: palette.sol, alpha: 0.6 })
      .circle(stage.x, stage.y, STAGE.disc)
      .fill(palette.sol)
      .stroke({ width: 18, color: palette[stage.token] });
  }
  const trees: Tree[] = [];
  for (let tries = 0; trees.length < TREES.count && tries < TREES.count * 8; tries += 1) {
    const turn = nextFloat(rng) * TAU;
    const distance = TREES.near + nextFloat(rng) * (TREES.far - TREES.near);
    const x = core.x + Math.cos(turn) * distance;
    const y = core.y + Math.sin(turn) * distance * 0.8;
    const radius = TREES.radius + nextFloat(rng) * TREES.spread;
    const dry = shore === null || x - radius > shoreAt(shore, y) + TREES.shore;
    if (dry && stages.every((stage) => Math.hypot(stage.x - x, stage.y - y) > TREES.clear)) {
      trees.push({ x, y, radius });
    }
  }
  return { stages, trees };
}

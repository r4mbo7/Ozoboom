import { nextFloat, seedRng } from '../shared/prng';
import { type Shore, drawShore, shoreAt } from '../sim/shore';
import type { Arena } from '../sim/state';

export interface Tree {
  x: number;
  y: number;
  radius: number;
}

export interface Layout extends Shore {
  readonly floorRadius: number;
  readonly trees: readonly Tree[];
}

export const LAKE_DECOR = 'lake';

const TREE_COUNT = 10;
export const SOL_CLAIR_SHARE = { lawn: 0.3, tufts: 0.5, floor: 0.6 } as const;
export const LAKE_SKY_MIX = 0.5;
// For a screen up to 32:9 at the usual scale.
export const OVERFLOW = 640;
const SHORE_MARGIN = 70;
const FLOOR_SHARE = 0.34;
const EDGE_MARGIN = 60;
const TREE_RADIUS = [26, 40] as const;

export function layoutGround(seed: number, arena: Arena, clearings: readonly Tree[] = []): Layout {
  const rng = seedRng(seed >>> 0);
  const floorRadius = Math.min(arena.width, arena.height) * FLOOR_SHARE;
  const base: Layout = { ...drawShore(rng, arena), floorRadius, trees: [] };
  const trees: Tree[] = [];
  const cx = arena.width / 2;
  const cy = arena.height / 2;
  for (let attempt = 0; attempt < 2000 && trees.length < TREE_COUNT; attempt += 1) {
    const radius = TREE_RADIUS[0] + nextFloat(rng) * (TREE_RADIUS[1] - TREE_RADIUS[0]);
    const x = EDGE_MARGIN + radius + nextFloat(rng) * (arena.width - 2 * (EDGE_MARGIN + radius));
    const y = EDGE_MARGIN + radius + nextFloat(rng) * (arena.height - 2 * (EDGE_MARGIN + radius));
    const clear =
      Math.hypot(x - cx, y - cy) > floorRadius * 1.12 + radius &&
      x - radius > shoreAt(base, y) + SHORE_MARGIN &&
      trees.every((tree) => Math.hypot(x - tree.x, y - tree.y) > (radius + tree.radius) * 1.8) &&
      clearings.every((spot) => Math.hypot(x - spot.x, y - spot.y) > radius + spot.radius);
    if (clear) {
      trees.push({ x, y, radius });
    }
  }
  return { ...base, trees };
}

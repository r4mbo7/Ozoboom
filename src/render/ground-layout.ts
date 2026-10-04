import { nextFloat, seedRng } from '../shared/prng';
import type { Arena } from '../sim/state';

export interface Tree {
  x: number;
  y: number;
  radius: number;
}

interface Wave {
  amplitude: number;
  frequency: number;
  phase: number;
}

export interface Layout {
  readonly arena: Arena;
  readonly floorRadius: number;
  readonly shoreBase: number;
  readonly waves: readonly Wave[];
  readonly trees: readonly Tree[];
}

export const TREE_COUNT = 10;
// Share of solClair laid over sol: the lawn, its lightest tufts, the dance floor.
export const SOL_CLAIR_SHARE = { lawn: 0.3, tufts: 0.5, floor: 0.6 } as const;
export const LAKE_SKY_MIX = 0.5;
const LAKE_SHARE = 0.17;
const SHORE_MARGIN = 70;
const FLOOR_SHARE = 0.34;
const EDGE_MARGIN = 60;
const TREE_RADIUS = [26, 40] as const;

export function shoreAt(layout: Layout, y: number): number {
  let x = layout.shoreBase;
  for (const { amplitude, frequency, phase } of layout.waves) {
    x += amplitude * Math.sin((y / layout.arena.height) * frequency + phase);
  }
  return x;
}

// The lake's left shore and the trees come from the seed of the run: same arena, same seed, same shore.
export function layoutGround(seed: number, arena: Arena): Layout {
  const rng = seedRng(seed >>> 0);
  const waves = [
    { amplitude: arena.width * 0.035, frequency: 5.2, phase: nextFloat(rng) * Math.PI * 2 },
    { amplitude: arena.width * 0.018, frequency: 11.7, phase: nextFloat(rng) * Math.PI * 2 },
    { amplitude: arena.width * 0.008, frequency: 23.1, phase: nextFloat(rng) * Math.PI * 2 },
  ];
  const floorRadius = Math.min(arena.width, arena.height) * FLOOR_SHARE;
  const base: Layout = {
    arena,
    floorRadius,
    shoreBase: arena.width * LAKE_SHARE,
    waves,
    trees: [],
  };
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
      trees.every((tree) => Math.hypot(x - tree.x, y - tree.y) > (radius + tree.radius) * 1.8);
    if (clear) {
      trees.push({ x, y, radius });
    }
  }
  return { ...base, trees };
}

import { nextFloat, seedRng } from '../shared/prng';
import type { Arena } from '../sim/state';
import { type Almond, FLOOR, SCALE, almondEdge } from './ambyss-layout';
import type { Vec2 } from '../shared/vec';
import type { Tree } from './ground-layout';

export const AISLE = { x: 20 * SCALE, y: 16 * SCALE } as const;
export const CROWD = [0xc9a0b8, 0xa0b8c9, 0xc9c0a0, 0xa0c9b0, 0xb8a0c9] as const;

const ROWS = [0.44, 0.58, 0.72, 0.86] as const;
const SEAT_SPACING = 10.5 * SCALE;
const EMPTY_SPOT = 0.1;
const SEATED = 0.72;
// Clumps of trees at the foot of the hill, as shares of the arena, with how many trees each.
const CLUMPS = [
  [0.058, 0.1, 4],
  [0.942, 0.122, 3],
  [0.075, 0.911, 3],
  [0.933, 0.889, 4],
  [0.517, 0.044, 2],
  [0.467, 0.967, 2],
] as const;
const CLUMP_SPREAD = { x: 110 * SCALE, y: 70 * SCALE } as const;
const TREE_RADIUS = [18 * SCALE, 34 * SCALE] as const;

export interface Seat extends Vec2 {
  // Turned so that its front faces the core.
  readonly angle: number;
  readonly festivalGoer: number | null;
}

// Red cushions in curved rows, smaller almonds inside the floor, an aisle along each axis.
export function seatsOf(center: Vec2, seed: number): Seat[] {
  const rng = seedRng((seed + 7121) >>> 0);
  const seats: Seat[] = [];
  for (const share of ROWS) {
    const row: Almond = {
      halfWidth: FLOOR.halfWidth * share,
      halfHeight: FLOOR.halfHeight * share,
    };
    const count = Math.round(row.halfWidth / SEAT_SPACING);
    for (const north of [true, false]) {
      for (let index = 0; index < count; index += 1) {
        const { x, y } = almondEdge(center, row, (index + 0.5) / count, north);
        if (
          Math.abs(x - center.x) < AISLE.x ||
          Math.abs(y - center.y) < AISLE.y ||
          nextFloat(rng) < EMPTY_SPOT
        ) {
          continue;
        }
        const angle = Math.atan2(center.y - y, center.x - x) + Math.PI / 2;
        const festivalGoer =
          nextFloat(rng) < SEATED
            ? (CROWD[Math.floor(nextFloat(rng) * CROWD.length)] ?? null)
            : null;
        seats.push({ x, y, angle, festivalGoer });
      }
    }
  }
  return seats;
}

export function groveOf(arena: Arena, seed: number): Tree[] {
  const rng = seedRng((seed + 6043) >>> 0);
  const trees: Tree[] = [];
  for (const [shareX, shareY, count] of CLUMPS) {
    for (let index = 0; index < count; index += 1) {
      trees.push({
        x: arena.width * shareX + (nextFloat(rng) - 0.5) * CLUMP_SPREAD.x,
        y: arena.height * shareY + (nextFloat(rng) - 0.5) * CLUMP_SPREAD.y,
        radius: TREE_RADIUS[0] + nextFloat(rng) * (TREE_RADIUS[1] - TREE_RADIUS[0]),
      });
    }
  }
  return trees;
}

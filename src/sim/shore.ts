import type { SetDefinition } from '../data/types';
import { unitFromAngle } from '../shared/angle';
import { type RngState, nextFloat, seedRng } from '../shared/prng';
import type { Arena, Vec2 } from './state';

interface Wave {
  amplitude: number;
  frequency: number;
  phase: number;
}

// The edge of the water along the west side: the lake lies where x is below `shoreAt`.
export interface Shore {
  readonly arena: Arena;
  readonly shoreBase: number;
  readonly waves: readonly Wave[];
}

const LAKE_SHARE = 0.17;

export function shoreAt(shore: Shore, y: number): number {
  let x = shore.shoreBase;
  for (const { amplitude, frequency, phase } of shore.waves) {
    x += amplitude * unitFromAngle((y / shore.arena.height) * frequency + phase).y;
  }
  return x;
}

// Draws the first three numbers of `rng`: the ground's layout goes on drawing its trees after them.
export function drawShore(rng: RngState, arena: Arena): Shore {
  const waves = [
    { amplitude: arena.width * 0.035, frequency: 5.2, phase: nextFloat(rng) * Math.PI * 2 },
    { amplitude: arena.width * 0.018, frequency: 11.7, phase: nextFloat(rng) * Math.PI * 2 },
    { amplitude: arena.width * 0.008, frequency: 23.1, phase: nextFloat(rng) * Math.PI * 2 },
  ];
  return { arena, shoreBase: arena.width * LAKE_SHARE, waves };
}

export function lakeShore(seed: number, arena: Arena): Shore {
  return drawShore(seedRng(seed >>> 0), arena);
}

export function shoreOf(set: Pick<SetDefinition, 'lake' | 'arena'>, seed: number): Shore | null {
  return set.lake === true ? lakeShore(seed, set.arena) : null;
}

// A circle in the water, or less than its radius from the shore.
export function wet(shore: Shore | null, at: Vec2, radius: number): boolean {
  return shore !== null && at.x < shoreAt(shore, at.y) + radius;
}

// Straight out of the water to the east, onto the shore, where players walk.
export function ashore(shore: Shore | null, at: Vec2, radius: number): Vec2 {
  return shore === null || !wet(shore, at, radius)
    ? at
    : { x: shoreAt(shore, at.y) + radius, y: at.y };
}

export function keepAshore(
  shore: Shore | null,
  body: { x: number; y: number; radius: number },
): void {
  const { x } = ashore(shore, body, body.radius);
  body.x = x;
}

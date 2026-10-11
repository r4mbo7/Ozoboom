import { nextFloat, seedRng } from '../shared/prng';
import type { ObstacleDefinition } from '../data/types';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Light {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly group: number;
}

export const RIBS = 24;
export const TWINKLE_GROUPS = 3;
// The mock-up (1200 x 900) is scaled by 10/9 around the core.
export const SCALE = 10 / 9;
export const RING = 300 * SCALE;
export const RIB_FROM = 56 * SCALE;
export const PANELS = { from: 236 * SCALE, to: 282 * SCALE } as const;
export const LIGHTS = { from: 74 * SCALE, to: 232 * SCALE } as const;

// The crown's posts are the obstacles on the ring; the giants' arms lie further out.
export function crownPosts(
  obstacles: readonly ObstacleDefinition[],
  center: Point,
): readonly ObstacleDefinition[] {
  const distance = (o: ObstacleDefinition): number => Math.hypot(o.x - center.x, o.y - center.y);
  const ring = Math.min(...obstacles.map(distance));
  return obstacles.filter((o) => distance(o) < ring * 1.1);
}

// Group 0 stays lit; the others twinkle, each on its own phase.
export function garlands(seed: number, center: Point): readonly Light[] {
  const rng = seedRng(seed);
  const step = (Math.PI * 2) / RIBS;
  const lights: Light[] = [];
  for (let rib = 0; rib < RIBS; rib += 1) {
    for (let r = LIGHTS.from; r < LIGHTS.to; r += 11 * SCALE) {
      if (nextFloat(rng) < 0.55) {
        const angle = rib * step + step * (0.15 + nextFloat(rng) * 0.7);
        lights.push({
          x: center.x + Math.cos(angle) * r,
          y: center.y + Math.sin(angle) * r,
          radius: 0.9 + nextFloat(rng) * 1.3,
          group: nextFloat(rng) < 0.3 ? 1 + Math.floor(nextFloat(rng) * TWINKLE_GROUPS) : 0,
        });
      }
    }
  }
  return lights;
}

import type { ObstacleDefinition } from '../data/types';

export interface Point {
  x: number;
  y: number;
}

export interface GiantArm {
  readonly stones: readonly ObstacleDefinition[];
}

export interface GiantLayout {
  readonly angle: number;
  readonly arms: readonly [GiantArm, GiantArm];
}

const TAU = Math.PI * 2;
const CROWN_MARGIN = 1.15;
const DIAGONALS = [-0.75, -0.25, 0.25, 0.75].map((turn) => turn * Math.PI);

function wrap(angle: number): number {
  return ((((angle + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

// The crown is the nearest ring of obstacles to the core; what lies beyond it are the giants' arm stones. Each stone
// goes to the nearest diagonal, on the side of it that its angle falls, and an arm lists its stones from the body out.
export function layGiants(obstacles: readonly ObstacleDefinition[], center: Point): GiantLayout[] {
  const polar = obstacles.map((stone) => ({
    stone,
    distance: Math.hypot(stone.x - center.x, stone.y - center.y),
    angle: Math.atan2(stone.y - center.y, stone.x - center.x),
  }));
  const crown = Math.min(...polar.map(({ distance }) => distance));
  const arms = polar.filter(({ distance }) => distance > crown * CROWN_MARGIN);
  return DIAGONALS.map((angle) => {
    const sides: [typeof arms, typeof arms] = [[], []];
    for (const entry of arms) {
      const offset = wrap(entry.angle - angle);
      if (Math.abs(offset) < Math.PI / 4) {
        sides[offset <= 0 ? 0 : 1].push({ ...entry, angle: Math.abs(offset) });
      }
    }
    const [left, right] = sides.map((side) => ({
      stones: side.sort((a, b) => a.angle - b.angle).map(({ stone }) => stone),
    }));
    return { angle, arms: [left ?? { stones: [] }, right ?? { stones: [] }] };
  });
}

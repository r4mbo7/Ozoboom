import type { ObstacleDefinition } from '../data/types';
import { clamp01 } from '../shared/scalar';

const RESOLVE_PASSES = 2;
// Float slack so a circle pushed exactly to tangency does not count as overlapping.
const TOLERANCE = 1e-6;

interface Circle {
  x: number;
  y: number;
  radius: number;
}

// A circle that cannot fit goes back to `fromX`, `fromY`, unless already inside there: then it gets out.
export function resolveObstacles(
  circle: Circle,
  fromX: number,
  fromY: number,
  obstacles: readonly ObstacleDefinition[],
): void {
  if (obstacles.length === 0) {
    return;
  }
  for (let pass = 0; pass < RESOLVE_PASSES; pass++) {
    for (const obstacle of obstacles) {
      const dx = circle.x - obstacle.x;
      const dy = circle.y - obstacle.y;
      const touch = circle.radius + obstacle.radius;
      const squared = dx * dx + dy * dy;
      if (squared >= touch * touch) {
        continue;
      }
      const distance = Math.sqrt(squared);
      if (distance === 0) {
        circle.x += touch;
        continue;
      }
      const push = (touch - distance) / distance;
      circle.x += dx * push;
      circle.y += dy * push;
    }
  }
  if (overlaps(circle.x, circle.y, circle.radius, obstacles, TOLERANCE)) {
    if (!overlaps(fromX, fromY, circle.radius, obstacles, TOLERANCE)) {
      circle.x = fromX;
      circle.y = fromY;
    }
  }
}

// Nothing is drawn from the rng, so the same state always gives the same spot.
export function clearOfObstacles(
  point: { x: number; y: number },
  radius: number,
  obstacles: readonly ObstacleDefinition[],
): { x: number; y: number } {
  const circle = { x: point.x, y: point.y, radius };
  resolveObstacles(circle, point.x, point.y, obstacles);
  return { x: circle.x, y: circle.y };
}

export function touchesObstacle(circle: Circle, obstacles: readonly ObstacleDefinition[]): boolean {
  return overlaps(circle.x, circle.y, circle.radius, obstacles, 0);
}

function overlaps(
  x: number,
  y: number,
  radius: number,
  obstacles: readonly ObstacleDefinition[],
  tolerance: number,
): boolean {
  for (const obstacle of obstacles) {
    const dx = x - obstacle.x;
    const dy = y - obstacle.y;
    const touch = radius + obstacle.radius - tolerance;
    if (dx * dx + dy * dy < touch * touch) {
      return true;
    }
  }
  return false;
}

export function lineBlocked(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  obstacles: readonly ObstacleDefinition[],
): boolean {
  const lx = x1 - x0;
  const ly = y1 - y0;
  const lengthSquared = lx * lx + ly * ly;
  for (const obstacle of obstacles) {
    const ox = obstacle.x - x0;
    const oy = obstacle.y - y0;
    const t = lengthSquared === 0 ? 0 : clamp01((ox * lx + oy * ly) / lengthSquared);
    const dx = ox - lx * t;
    const dy = oy - ly * t;
    const touch = radius + obstacle.radius;
    if (dx * dx + dy * dy < touch * touch) {
      return true;
    }
  }
  return false;
}

// An obstacle it already overlaps does not hold it, so that it can get out.
export function freeShare(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  obstacles: readonly ObstacleDefinition[],
): number {
  const lx = x1 - x0;
  const ly = y1 - y0;
  const lengthSquared = lx * lx + ly * ly;
  let share = 1;
  if (lengthSquared === 0) {
    return share;
  }
  for (const obstacle of obstacles) {
    const ox = x0 - obstacle.x;
    const oy = y0 - obstacle.y;
    const touch = radius + obstacle.radius;
    const outside = ox * ox + oy * oy - touch * touch;
    const toward = ox * lx + oy * ly;
    const discriminant = toward * toward - lengthSquared * outside;
    if (outside <= 0 || toward >= 0 || discriminant < 0) {
      continue;
    }
    share = Math.min(share, (-toward - Math.sqrt(discriminant)) / lengthSquared);
  }
  return share;
}

import type { ObstacleDefinition } from '../data/types';

const RESOLVE_PASSES = 2;
// Float slack so a circle pushed exactly to tangency does not count as overlapping.
const TOLERANCE = 1e-6;

interface Circle {
  x: number;
  y: number;
  radius: number;
}

// Moves the circle out of every obstacle it overlaps, along the normal. When it cannot fit
// (a gap narrower than itself) it goes back to `fromX`, `fromY`, the spot it moved from, unless
// that spot was already inside an obstacle: then the push stands so it can get out.
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

// The point itself moved out of every obstacle, to the edge of the nearest one: nothing is
// drawn from the rng, so the same state always gives the same spot.
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

// Whether a circle of `radius` walking the straight line from (x0, y0) to (x1, y1) would touch an obstacle.
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
    const t =
      lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, (ox * lx + oy * ly) / lengthSquared));
    const dx = ox - lx * t;
    const dy = oy - ly * t;
    const touch = radius + obstacle.radius;
    if (dx * dx + dy * dy < touch * touch) {
      return true;
    }
  }
  return false;
}

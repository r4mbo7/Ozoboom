import type { ObstacleDefinition } from '../data/types';
import { clamp01 } from '../shared/scalar';
import { SpatialHash } from './spatial-hash';

const RESOLVE_PASSES = 2;
// About two cells of an obstacle's reach: a body's query reads a handful of cells.
const GRID_CELL_SIZE = 128;
// Float slack so a circle pushed exactly to tangency does not count as overlapping.
const TOLERANCE = 1e-6;

interface Circle {
  x: number;
  y: number;
  radius: number;
}

// A set's obstacles, filed once in a grid: they never move, so a body only tests those near it.
// A query reads whichever is shorter, the whole list or the grid cells around the body's path:
// a set with one obstacle stays a single test.
export class Obstacles {
  readonly list: readonly ObstacleDefinition[];
  private readonly grid: SpatialHash;
  private fromGrid = false;

  constructor(list: readonly ObstacleDefinition[], width: number, height: number) {
    this.list = list;
    this.grid = new SpatialHash(width, height, GRID_CELL_SIZE);
    this.grid.rebuild(list);
  }

  // The obstacles that may touch a circle, read by `at`; the caller keeps its exact test.
  around(x: number, y: number, radius: number): number {
    this.fromGrid = this.list.length > this.grid.cellsAlong(x, y, x, y, radius);
    return this.fromGrid ? this.grid.query(x, y, radius) : this.list.length;
  }

  // The obstacles that may touch a circle moving from one point to the other, read by `at`.
  along(x0: number, y0: number, x1: number, y1: number, radius: number): number {
    this.fromGrid = this.list.length > this.grid.cellsAlong(x0, y0, x1, y1, radius);
    return this.fromGrid ? this.grid.querySegment(x0, y0, x1, y1, radius) : this.list.length;
  }

  at(i: number): ObstacleDefinition | undefined {
    return this.list[this.fromGrid ? this.grid.result(i) : i];
  }
}

// A circle that cannot fit goes back to `fromX`, `fromY`, unless already inside there: then it gets out.
export function resolveObstacles(
  circle: Circle,
  fromX: number,
  fromY: number,
  obstacles: Obstacles,
): void {
  // Untouched, the passes below would leave it where it is.
  if (!touchesObstacle(circle, obstacles)) {
    return;
  }
  for (let pass = 0; pass < RESOLVE_PASSES; pass++) {
    for (const obstacle of obstacles.list) {
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
  obstacles: Obstacles,
): { x: number; y: number } {
  const circle = { x: point.x, y: point.y, radius };
  resolveObstacles(circle, point.x, point.y, obstacles);
  return { x: circle.x, y: circle.y };
}

export function touchesObstacle(circle: Circle, obstacles: Obstacles): boolean {
  return overlaps(circle.x, circle.y, circle.radius, obstacles, 0);
}

function overlaps(
  x: number,
  y: number,
  radius: number,
  obstacles: Obstacles,
  tolerance: number,
): boolean {
  const found = obstacles.around(x, y, radius);
  for (let i = 0; i < found; i++) {
    const obstacle = obstacles.at(i);
    if (obstacle === undefined) {
      continue;
    }
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
  obstacles: Obstacles,
): boolean {
  const lx = x1 - x0;
  const ly = y1 - y0;
  const lengthSquared = lx * lx + ly * ly;
  const found = obstacles.along(x0, y0, x1, y1, radius);
  for (let i = 0; i < found; i++) {
    const obstacle = obstacles.at(i);
    if (obstacle === undefined) {
      continue;
    }
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

// A charge, a push or a pull stops at the first obstacle in its way rather than leaping it.
export function moveUntilBlocked(body: Circle, dx: number, dy: number, obstacles: Obstacles): void {
  const share = freeShare(body.x, body.y, body.x + dx, body.y + dy, body.radius, obstacles);
  body.x += dx * share;
  body.y += dy * share;
}

// An obstacle it already overlaps does not hold it, so that it can get out; one it only touches does.
function freeShare(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  obstacles: Obstacles,
): number {
  const lx = x1 - x0;
  const ly = y1 - y0;
  const lengthSquared = lx * lx + ly * ly;
  let share = 1;
  if (lengthSquared === 0) {
    return share;
  }
  // The smallest share does not depend on the order the obstacles come in.
  const found = obstacles.along(x0, y0, x1, y1, radius);
  for (let i = 0; i < found; i++) {
    const obstacle = obstacles.at(i);
    if (obstacle === undefined) {
      continue;
    }
    const ox = x0 - obstacle.x;
    const oy = y0 - obstacle.y;
    const touch = radius + obstacle.radius;
    const squared = ox * ox + oy * oy;
    const toward = ox * lx + oy * ly;
    const discriminant = toward * toward - lengthSquared * (squared - touch * touch);
    const overlapping = squared < (touch - TOLERANCE) * (touch - TOLERANCE);
    if (overlapping || toward >= 0 || discriminant < 0) {
      continue;
    }
    share = Math.min(share, Math.max(0, (-toward - Math.sqrt(discriminant)) / lengthSquared));
  }
  return share;
}

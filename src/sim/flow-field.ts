import type { SetDefinition } from '../data/types';
import { touchesObstacle } from './obstacles';

const CELL = 16;
const UNREACHED = 0x7fffffff;
// Neighbours, the four straight ones first so a tie keeps the straighter step.
const STEP_X = [1, -1, 0, 0, 1, 1, -1, -1];
const STEP_Y = [0, 0, 1, -1, 1, -1, 1, -1];

interface SizeClass {
  radius: number;
  // Per cell, the cell to walk to on the way to the core, or -1 at the core and where there is none.
  next: Int32Array;
}

export interface FlowFields {
  cols: number;
  rows: number;
  classes: readonly SizeClass[];
}

// One field per distinct bad vibe radius, built once from the set: a breadth-first search from the
// core over a grid of cells where a circle of that radius fits. Integers and + - * / only.
export function createFlowFields(
  set: SetDefinition,
  radii: readonly number[],
): FlowFields | undefined {
  const obstacles = set.obstacles ?? [];
  if (obstacles.length === 0) {
    return undefined;
  }
  const cols = Math.ceil(set.arena.width / CELL);
  const rows = Math.ceil(set.arena.height / CELL);
  const distinct = [...new Set(radii)].sort((a, b) => a - b);
  return {
    cols,
    rows,
    classes: distinct.map((radius) => ({ radius, next: buildClass(set, cols, rows, radius) })),
  };
}

function buildClass(set: SetDefinition, cols: number, rows: number, radius: number): Int32Array {
  const obstacles = set.obstacles ?? [];
  const cells = cols * rows;
  const clear = new Uint8Array(cells);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col + 0.5) * CELL;
      const y = (row + 0.5) * CELL;
      const inside =
        x >= radius &&
        x <= set.arena.width - radius &&
        y >= radius &&
        y <= set.arena.height - radius;
      clear[row * cols + col] = inside && !touchesObstacle({ x, y, radius }, obstacles) ? 1 : 0;
    }
  }

  const distance = new Int32Array(cells).fill(UNREACHED);
  const queue = new Int32Array(cells);
  let tail = 0;
  const arrival = set.core.radius + radius + CELL;
  const coreCenter = { x: set.arena.width / 2, y: set.arena.height / 2 };
  for (let i = 0; i < cells; i++) {
    const dx = ((i % cols) + 0.5) * CELL - coreCenter.x;
    const dy = (Math.floor(i / cols) + 0.5) * CELL - coreCenter.y;
    if (clear[i] === 1 && dx * dx + dy * dy <= arrival * arrival) {
      distance[i] = 0;
      queue[tail++] = i;
    }
  }
  for (let head = 0; head < tail; head++) {
    const cell = queue[head] ?? 0;
    for (let k = 0; k < 8; k++) {
      const neighbour = stepTo(cell, k, cols, rows, clear);
      if (neighbour >= 0 && distance[neighbour] === UNREACHED) {
        distance[neighbour] = (distance[cell] ?? 0) + 1;
        queue[tail++] = neighbour;
      }
    }
  }

  const next = new Int32Array(cells).fill(-1);
  for (let cell = 0; cell < cells; cell++) {
    let best = distance[cell] ?? UNREACHED;
    for (let k = 0; k < 8; k++) {
      const neighbour = stepTo(cell, k, cols, rows, clear, true);
      const value = neighbour >= 0 ? (distance[neighbour] ?? UNREACHED) : UNREACHED;
      if (value < best) {
        best = value;
        next[cell] = neighbour;
      }
    }
  }
  return next;
}

// The neighbour of `cell` in direction `k` if a circle can walk there, else -1. A diagonal step
// may not cut the corner of a blocked cell. `fromBlocked` lets a blocked cell step out to a clear one.
function stepTo(
  cell: number,
  k: number,
  cols: number,
  rows: number,
  clear: Uint8Array,
  fromBlocked = false,
): number {
  const dx = STEP_X[k] ?? 0;
  const dy = STEP_Y[k] ?? 0;
  const col = (cell % cols) + dx;
  const row = Math.floor(cell / cols) + dy;
  if (col < 0 || col >= cols || row < 0 || row >= rows) {
    return -1;
  }
  const neighbour = row * cols + col;
  if (clear[neighbour] !== 1) {
    return -1;
  }
  if (clear[cell] !== 1) {
    return fromBlocked ? neighbour : -1;
  }
  if (dx !== 0 && dy !== 0 && (clear[cell + dx] !== 1 || clear[cell + dy * cols] !== 1)) {
    return -1;
  }
  return neighbour;
}

// Writes in `out` the center of the cell to walk to from (x, y) for a bad vibe of this radius.
// False when this radius has no field or there is no way to the core from here.
export function flowWaypoint(
  fields: FlowFields,
  radius: number,
  x: number,
  y: number,
  out: { x: number; y: number },
): boolean {
  for (const sizeClass of fields.classes) {
    if (sizeClass.radius !== radius) {
      continue;
    }
    const col = Math.min(fields.cols - 1, Math.max(0, Math.floor(x / CELL)));
    const row = Math.min(fields.rows - 1, Math.max(0, Math.floor(y / CELL)));
    const target = sizeClass.next[row * fields.cols + col] ?? -1;
    if (target < 0) {
      return false;
    }
    const targetRow = Math.floor(target / fields.cols);
    out.x = (target - targetRow * fields.cols + 0.5) * CELL;
    out.y = (targetRow + 0.5) * CELL;
    return true;
  }
  return false;
}

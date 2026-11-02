import { clamp, clamp01 } from '../shared/scalar';

export interface Circle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

const INITIAL_CAPACITY = 256;

// Its buffers only grow, so once they fit the largest crowd, nothing allocates in the hot loop.
export class SpatialHash {
  private readonly cellSize: number;
  private readonly columns: number;
  private readonly rows: number;
  private readonly cellStart: Int32Array;
  private readonly cellCursor: Int32Array;
  private circles: readonly Circle[] = [];
  private cellOfItem = new Int32Array(INITIAL_CAPACITY);
  private itemsByCell = new Int32Array(INITIAL_CAPACITY);
  private results = new Int32Array(INITIAL_CAPACITY);
  private maxRadius = 0;

  constructor(width: number, height: number, cellSize: number) {
    this.cellSize = cellSize;
    this.columns = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    this.cellStart = new Int32Array(this.columns * this.rows + 1);
    this.cellCursor = new Int32Array(this.columns * this.rows);
  }

  rebuild(circles: readonly Circle[]): void {
    const count = circles.length;
    if (count > this.itemsByCell.length) {
      const capacity = grownCapacity(this.itemsByCell.length, count);
      this.cellOfItem = new Int32Array(capacity);
      this.itemsByCell = new Int32Array(capacity);
    }
    this.circles = circles;
    this.maxRadius = 0;
    this.cellStart.fill(0);
    for (let i = 0; i < count; i++) {
      const circle = circles[i];
      const cell =
        circle === undefined ? 0 : this.row(circle.y) * this.columns + this.column(circle.x);
      this.cellOfItem[i] = cell;
      this.cellStart[cell + 1] = (this.cellStart[cell + 1] ?? 0) + 1;
      this.maxRadius = Math.max(this.maxRadius, circle?.radius ?? 0);
    }
    for (let cell = 0; cell < this.cellCursor.length; cell++) {
      const start = this.cellStart[cell] ?? 0;
      this.cellCursor[cell] = start;
      this.cellStart[cell + 1] = start + (this.cellStart[cell + 1] ?? 0);
    }
    for (let i = 0; i < count; i++) {
      const cell = this.cellOfItem[i] ?? 0;
      const slot = this.cellCursor[cell] ?? 0;
      this.itemsByCell[slot] = i;
      this.cellCursor[cell] = slot + 1;
    }
  }

  query(x: number, y: number, radius: number): number {
    const reach = radius + this.maxRadius;
    const firstColumn = this.column(x - reach);
    const lastColumn = this.column(x + reach);
    const firstRow = this.row(y - reach);
    const lastRow = this.row(y + reach);
    let found = 0;
    for (let row = firstRow; row <= lastRow; row++) {
      for (let column = firstColumn; column <= lastColumn; column++) {
        const cell = row * this.columns + column;
        const end = this.cellStart[cell + 1] ?? 0;
        for (let slot = this.cellStart[cell] ?? 0; slot < end; slot++) {
          const index = this.itemsByCell[slot] ?? 0;
          const circle = this.circles[index];
          if (circle === undefined) {
            continue;
          }
          const dx = circle.x - x;
          const dy = circle.y - y;
          const touch = circle.radius + radius;
          if (dx * dx + dy * dy <= touch * touch) {
            found = this.keep(found, index);
          }
        }
      }
    }
    return found;
  }

  // As `query`, the results in the order of the list the grid was built from: hits land in the
  // order a loop over the whole list would give them.
  queryInListOrder(x: number, y: number, radius: number): number {
    return this.inListOrder(this.query(x, y, radius));
  }

  // The circles that come within `radius` of the segment, in no set order: only the cells the
  // segment crosses are read, so a short path through a crowded field stays cheap.
  querySegment(x0: number, y0: number, x1: number, y1: number, radius: number): number {
    const reach = radius + this.maxRadius;
    const lastRow = this.row(Math.max(y0, y1) + reach);
    let found = 0;
    for (let row = this.row(Math.min(y0, y1) - reach); row <= lastRow; row++) {
      // The border rows also hold the circles past the arena edge.
      const top = row === 0 ? -Infinity : row * this.cellSize - reach;
      const bottom = row === this.rows - 1 ? Infinity : (row + 1) * this.cellSize + reach;
      let from = 0;
      let to = 1;
      if (y0 === y1) {
        if (y0 < top || y0 > bottom) {
          continue;
        }
      } else {
        const atTop = (top - y0) / (y1 - y0);
        const atBottom = (bottom - y0) / (y1 - y0);
        from = Math.max(0, Math.min(atTop, atBottom));
        to = Math.min(1, Math.max(atTop, atBottom));
        if (from > to) {
          continue;
        }
      }
      const xFrom = x0 + (x1 - x0) * from;
      const xTo = x0 + (x1 - x0) * to;
      const lastColumn = this.column(Math.max(xFrom, xTo) + reach);
      for (let column = this.column(Math.min(xFrom, xTo) - reach); column <= lastColumn; column++) {
        const cell = row * this.columns + column;
        const end = this.cellStart[cell + 1] ?? 0;
        for (let slot = this.cellStart[cell] ?? 0; slot < end; slot++) {
          const index = this.itemsByCell[slot] ?? 0;
          const circle = this.circles[index];
          if (circle !== undefined && nearSegment(circle, x0, y0, x1, y1, radius)) {
            found = this.keep(found, index);
          }
        }
      }
    }
    return found;
  }

  // As `querySegment`, the results in the order of the list the grid was built from.
  querySegmentInListOrder(x0: number, y0: number, x1: number, y1: number, radius: number): number {
    return this.inListOrder(this.querySegment(x0, y0, x1, y1, radius));
  }

  // The most cells a query reads around this segment, or this point: those of its bounding box.
  cellsAlong(x0: number, y0: number, x1: number, y1: number, radius: number): number {
    const reach = radius + this.maxRadius;
    const columns = this.column(Math.max(x0, x1) + reach) - this.column(Math.min(x0, x1) - reach);
    const rows = this.row(Math.max(y0, y1) + reach) - this.row(Math.min(y0, y1) - reach);
    return (columns + 1) * (rows + 1);
  }

  // The radius of the widest circle: a query for a shape that grows with the circle it meets adds it
  // to its own reach.
  widestRadius(): number {
    return this.maxRadius;
  }

  result(i: number): number {
    return this.results[i] ?? -1;
  }

  private inListOrder(found: number): number {
    this.results.subarray(0, found).sort();
    return found;
  }

  private keep(found: number, index: number): number {
    if (found === this.results.length) {
      const grown = new Int32Array(grownCapacity(found, found + 1));
      grown.set(this.results);
      this.results = grown;
    }
    this.results[found] = index;
    return found + 1;
  }

  private column(x: number): number {
    return clamp(Math.floor(x / this.cellSize), 0, this.columns - 1);
  }

  private row(y: number): number {
    return clamp(Math.floor(y / this.cellSize), 0, this.rows - 1);
  }
}

function nearSegment(
  circle: Circle,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
): boolean {
  const lx = x1 - x0;
  const ly = y1 - y0;
  const lengthSquared = lx * lx + ly * ly;
  const ox = circle.x - x0;
  const oy = circle.y - y0;
  const t = lengthSquared === 0 ? 0 : clamp01((ox * lx + oy * ly) / lengthSquared);
  const dx = ox - lx * t;
  const dy = oy - ly * t;
  const touch = circle.radius + radius;
  return dx * dx + dy * dy <= touch * touch;
}

function grownCapacity(current: number, needed: number): number {
  let capacity = Math.max(current, INITIAL_CAPACITY);
  while (capacity < needed) {
    capacity *= 2;
  }
  return capacity;
}

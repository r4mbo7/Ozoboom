export interface Circle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

const INITIAL_CAPACITY = 256;

// Uniform grid rebuilt each tick by counting sort. Its buffers only grow, so once they fit the
// largest crowd a rebuild or a query allocates nothing. Results are indices in the rebuilt list.
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

  // Finds the circles that overlap the query circle; read them with result(0 .. count - 1).
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
            if (found === this.results.length) {
              const grown = new Int32Array(grownCapacity(found, found + 1));
              grown.set(this.results);
              this.results = grown;
            }
            this.results[found] = index;
            found += 1;
          }
        }
      }
    }
    return found;
  }

  result(i: number): number {
    return this.results[i] ?? -1;
  }

  private column(x: number): number {
    return Math.min(this.columns - 1, Math.max(0, Math.floor(x / this.cellSize)));
  }

  private row(y: number): number {
    return Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cellSize)));
  }
}

function grownCapacity(current: number, needed: number): number {
  let capacity = Math.max(current, INITIAL_CAPACITY);
  while (capacity < needed) {
    capacity *= 2;
  }
  return capacity;
}

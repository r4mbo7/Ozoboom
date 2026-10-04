import { describe, expect, it } from 'vitest';
import { SpatialHash } from './spatial-hash';

const circle = (x: number, y: number, radius = 10) => ({ x, y, radius });

function neighbours(grid: SpatialHash, x: number, y: number, radius: number): number[] {
  const found: number[] = [];
  const count = grid.query(x, y, radius);
  for (let i = 0; i < count; i++) {
    found.push(grid.result(i));
  }
  return found.sort((a, b) => a - b);
}

describe('SpatialHash', () => {
  it('finds every circle that overlaps the query circle, across cells', () => {
    const grid = new SpatialHash(1000, 1000, 64);
    grid.rebuild([circle(100, 100), circle(150, 100), circle(100, 165), circle(500, 500)]);

    const found = neighbours(grid, 100, 100, 60);

    expect(found).toEqual([0, 1, 2]);
  });

  it('ignores circles whose edge stays out of reach', () => {
    const grid = new SpatialHash(1000, 1000, 64);
    grid.rebuild([circle(100, 100, 5), circle(170, 100, 5), circle(100, 164, 5)]);

    const found = neighbours(grid, 100, 100, 60);

    expect(found).toEqual([0, 2]);
  });

  it('reaches a big circle whose center lies several cells away', () => {
    const grid = new SpatialHash(1000, 1000, 32);
    grid.rebuild([circle(300, 300, 150)]);

    const found = neighbours(grid, 300, 160, 5);

    expect(found).toEqual([0]);
  });

  it('keeps circles past the arena edge in the border cells', () => {
    const grid = new SpatialHash(640, 640, 64);
    grid.rebuild([circle(-20, -20), circle(700, 660)]);

    expect(neighbours(grid, 0, 0, 20)).toEqual([0]);
    expect(neighbours(grid, 640, 640, 60)).toEqual([1]);
  });

  it('forgets the previous circles when rebuilt, and grows past its first capacity', () => {
    const grid = new SpatialHash(1000, 1000, 64);
    grid.rebuild([circle(100, 100)]);
    const many = Array.from({ length: 500 }, (_, i) => circle(200 + (i % 25), 200 + (i % 20), 30));

    grid.rebuild(many);

    expect(neighbours(grid, 100, 100, 5)).toEqual([]);
    expect(neighbours(grid, 210, 210, 1)).toHaveLength(500);
  });
});

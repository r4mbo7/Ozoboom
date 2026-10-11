import { describe, expect, it } from 'vitest';
import { CANOPY, FLOOR, insideAlmond, almondEdge } from './ambyss-layout';

const center = { x: 800, y: 500 };

describe('The Ambyss almond', () => {
  it('Given the floor, when its edge is walked, then it runs from tip to tip through the apex', () => {
    expect(almondEdge(center, FLOOR, 0, true).x).toBeCloseTo(center.x - FLOOR.halfWidth, 6);
    expect(almondEdge(center, FLOOR, 1, false).x).toBeCloseTo(center.x + FLOOR.halfWidth, 6);
    const apex = almondEdge(center, FLOOR, 0.5, true);
    expect(apex.x).toBeCloseTo(center.x, 6);
    expect(apex.y).toBeCloseTo(center.y - FLOOR.halfHeight, 6);
    expect(almondEdge(center, FLOOR, 0.5, false).y).toBeCloseTo(center.y + FLOOR.halfHeight, 6);
  });

  it('Given points, when tested, then the core is inside, the corners outside, and a margin grows it', () => {
    expect(insideAlmond(center, FLOOR, center)).toBe(true);
    expect(insideAlmond(center, FLOOR, { x: 0, y: 0 })).toBe(false);
    const beyondApex = { x: center.x, y: center.y - FLOOR.halfHeight - 10 };
    expect(insideAlmond(center, FLOOR, beyondApex)).toBe(false);
    expect(insideAlmond(center, FLOOR, beyondApex, 20)).toBe(true);
  });

  it('Given the canopy, then it covers the floor, almond shaped like a vesica piscis', () => {
    expect(CANOPY.halfWidth).toBeGreaterThan(FLOOR.halfWidth);
    expect(CANOPY.halfHeight).toBeGreaterThan(FLOOR.halfHeight);
    expect(FLOOR.halfWidth / FLOOR.halfHeight).toBeCloseTo(Math.sqrt(3), 1);
  });
});

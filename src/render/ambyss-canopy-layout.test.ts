import { describe, expect, it } from 'vitest';
import { CANOPY, FLOOR, ROPE_LENGTH, insideAlmond } from './ambyss-layout';
import { canopyLayout, spiralPoints } from './ambyss-canopy-layout';

const center = { x: 800, y: 500 };
const arena = { width: 1600, height: 1000 };
const canopy = canopyLayout(center);

describe('The Ambyss canopy', () => {
  it('Given the canopy, then its anchors sit on its edge, the two tips among them, turning around the core', () => {
    expect(canopy.anchors).toHaveLength(14);
    for (const anchor of canopy.anchors) {
      expect(insideAlmond(center, CANOPY, anchor, 0.5)).toBe(true);
      expect(insideAlmond(center, CANOPY, anchor, -0.5)).toBe(false);
    }
    const xs = canopy.anchors.map(({ x }) => x);
    expect(Math.min(...xs)).toBeCloseTo(center.x - CANOPY.halfWidth, 6);
    expect(Math.max(...xs)).toBeCloseTo(center.x + CANOPY.halfWidth, 6);
    const angles = canopy.anchors.map(({ x, y }) => Math.atan2(y - center.y, x - center.x));
    expect(angles).toEqual([...angles].sort((a, b) => a - b));
  });

  it('Given the scalloped edge, then each span bows toward the core, inside the canopy', () => {
    expect(canopy.scallops).toHaveLength(canopy.anchors.length);
    const reach = ({ x, y }: { x: number; y: number }) => Math.hypot(x - center.x, y - center.y);
    for (const [index, span] of canopy.scallops.entries()) {
      const from = canopy.anchors[index] ?? center;
      expect(span.to).toEqual(canopy.anchors[(index + 1) % canopy.anchors.length]);
      const middle = { x: (from.x + span.to.x) / 2, y: (from.y + span.to.y) / 2 };
      expect(reach(span.control)).toBeCloseTo(reach(middle) * 0.84, 6);
      expect(insideAlmond(center, CANOPY, span.control)).toBe(true);
    }
  });

  it('Given the masts, then they stand on the east-west axis, one each side of the core, on the floor', () => {
    const [west, east] = canopy.masts;
    expect(west.y).toBe(center.y);
    expect(east.y).toBe(center.y);
    expect(center.x - west.x).toBeCloseTo(east.x - center.x, 6);
    expect(west.x).toBeLessThan(center.x - 150);
    expect(insideAlmond(center, FLOOR, west)).toBe(true);
    expect(insideAlmond(center, FLOOR, east)).toBe(true);
  });

  it('Given the seams, then each runs from the mast of its side to an anchor', () => {
    expect(canopy.seams).toHaveLength(canopy.anchors.length);
    for (const seam of canopy.seams) {
      const mast = seam.to.x < center.x ? canopy.masts[0] : canopy.masts[1];
      expect(seam.from).toEqual(mast);
    }
  });

  it('Given the guy ropes, then two leave each anchor, a rope length out to their pegs, inside the arena', () => {
    expect(canopy.ropes).toHaveLength(canopy.anchors.length * 2);
    for (const rope of canopy.ropes) {
      expect(Math.hypot(rope.to.x - rope.from.x, rope.to.y - rope.from.y)).toBeCloseTo(
        ROPE_LENGTH,
        6,
      );
      expect(insideAlmond(center, CANOPY, rope.to)).toBe(false);
      expect(rope.to.x).toBeGreaterThan(0);
      expect(rope.to.x).toBeLessThan(arena.width);
      expect(rope.to.y).toBeGreaterThan(0);
      expect(rope.to.y).toBeLessThan(arena.height);
    }
  });

  it('Given a painted spiral, then it winds out from its centre to its radius, wider than tall', () => {
    for (const spiral of canopy.spirals) {
      expect(insideAlmond(center, CANOPY, spiral.center)).toBe(true);
      const points = spiralPoints(spiral);
      expect(points[0]).toEqual(spiral.center);
      const last = points.at(-1) ?? spiral.center;
      expect(Math.hypot(last.x - spiral.center.x, last.y - spiral.center.y)).toBeGreaterThan(
        spiral.radius * 0.9,
      );
      const xs = points.map(({ x }) => x);
      const ys = points.map(({ y }) => y);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
    }
  });
});

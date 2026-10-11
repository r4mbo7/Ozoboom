import { describe, expect, it } from 'vitest';
import { CANOPY, FLOOR, ROPE_LENGTH, insideAlmond } from './ambyss-layout';
import { AISLE, CROWD, groveOf, seatsOf } from './butte-layout';

const ARENA = { width: 1600, height: 1000 };
const center = { x: 800, y: 500 };

describe('The cushions of Ambyss', () => {
  it('Given a seed, when the cushions are laid, then they sit on the floor, off both aisles, facing the core', () => {
    const seats = seatsOf(center, 7);

    expect(seats.length).toBeGreaterThan(100);
    for (const seat of seats) {
      expect(insideAlmond(center, FLOOR, seat)).toBe(true);
      expect(Math.abs(seat.x - center.x)).toBeGreaterThanOrEqual(AISLE.x);
      expect(Math.abs(seat.y - center.y)).toBeGreaterThanOrEqual(AISLE.y);
      const toCore = Math.atan2(center.y - seat.y, center.x - seat.x);
      expect(Math.cos(seat.angle - Math.PI / 2 - toCore)).toBeCloseTo(1, 6);
    }
  });

  it('Given a seed, when the cushions are laid twice, then they match, most with someone seated', () => {
    const seats = seatsOf(center, 7);
    const seated = seats.filter((seat) => seat.festivalGoer !== null);

    expect(seatsOf(center, 7)).toEqual(seats);
    expect(seated.length / seats.length).toBeGreaterThan(0.6);
    expect(seated.length).toBeLessThan(seats.length);
    for (const { festivalGoer } of seated) {
      expect(CROWD).toContain(festivalGoer);
    }
  });
});

describe('The grove of Ambyss', () => {
  it.each([1, 9, 123456])(
    'Given seed %s, when the grove is planted, then its trees stand at the foot of the hill, clear of the canopy and its ropes',
    (seed) => {
      const trees = groveOf(ARENA, seed);

      expect(trees.length).toBeGreaterThan(12);
      expect(groveOf(ARENA, seed)).toEqual(trees);
      for (const tree of trees) {
        expect(insideAlmond(center, CANOPY, tree, ROPE_LENGTH + tree.radius)).toBe(false);
      }
    },
  );
});

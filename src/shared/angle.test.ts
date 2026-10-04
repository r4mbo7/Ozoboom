import { describe, expect, it } from 'vitest';
import { angleOf, rotate, unitFromAngle } from './angle';
import { length } from './vec';

const samples = Array.from({ length: 721 }, (_, i) => -4 * Math.PI + (i * Math.PI) / 90);

describe('unitFromAngle', () => {
  it('matches the cosine and sine of the angle over several turns', () => {
    for (const angle of samples) {
      const unit = unitFromAngle(angle);

      expect(unit.x).toBeCloseTo(Math.cos(angle), 13);
      expect(unit.y).toBeCloseTo(Math.sin(angle), 13);
    }
  });

  it('gives exactly the x axis for a zero angle', () => {
    expect(unitFromAngle(0)).toEqual({ x: 1, y: 0 });
  });
});

describe('angleOf', () => {
  it('matches atan2 all around the circle and at any length', () => {
    for (const angle of samples) {
      const v = { x: 7 * Math.cos(angle), y: 7 * Math.sin(angle) };

      expect(angleOf(v)).toBeCloseTo(Math.atan2(v.y, v.x), 13);
    }
  });

  it('handles the axes and the zero vector', () => {
    expect(angleOf({ x: 1, y: 0 })).toBe(0);
    expect(angleOf({ x: -2, y: 0 })).toBe(Math.PI);
    expect(angleOf({ x: 0, y: 3 })).toBeCloseTo(Math.PI / 2, 15);
    expect(angleOf({ x: 0, y: -3 })).toBeCloseTo(-Math.PI / 2, 15);
    expect(angleOf({ x: 0, y: 0 })).toBe(0);
  });

  it('stays accurate just off the negative x axis', () => {
    const v = { x: -1, y: 1e-9 };

    expect(angleOf(v)).toBeCloseTo(Math.atan2(v.y, v.x), 15);
  });
});

describe('rotate', () => {
  it('turns a vector by the angle and keeps its length', () => {
    const v = { x: 0, y: 2 };

    const turned = rotate(v, Math.PI / 2);

    expect(turned.x).toBeCloseTo(-2, 14);
    expect(turned.y).toBeCloseTo(0, 14);
    expect(length(turned)).toBeCloseTo(2, 14);
  });
});

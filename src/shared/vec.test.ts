import { describe, expect, it } from 'vitest';
import { add, distanceSquared, dot, length, normalize, scale, sub } from './vec';

describe('length', () => {
  it('measures the euclidean length', () => {
    const v = { x: 3, y: -4 };

    expect(length(v)).toBe(5);
  });
});

describe('normalize', () => {
  it('keeps the direction and brings the length to 1', () => {
    const v = { x: 3, y: 4 };

    const unit = normalize(v);

    expect(unit).toEqual({ x: 0.6, y: 0.8 });
  });

  it('leaves the zero vector at zero', () => {
    const zero = { x: 0, y: 0 };

    expect(normalize(zero)).toEqual({ x: 0, y: 0 });
  });

  it('gives a unit vector for a diagonal', () => {
    const diagonal = { x: -1, y: 1 };

    const unit = normalize(diagonal);

    expect(length(unit)).toBeCloseTo(1, 15);
    expect(unit.x).toBe(-unit.y);
  });
});

describe('distanceSquared', () => {
  it('is the squared distance between two points', () => {
    const a = { x: 1, y: 2 };
    const b = { x: 4, y: 6 };

    expect(distanceSquared(a, b)).toBe(25);
    expect(distanceSquared(b, a)).toBe(25);
  });
});

describe('dot', () => {
  it('is zero for orthogonal vectors and the squared length for a vector with itself', () => {
    const v = { x: 2, y: 3 };

    expect(dot(v, { x: -3, y: 2 })).toBe(0);
    expect(dot(v, v)).toBe(13);
  });
});

describe('scale, add and sub', () => {
  it('return new vectors without touching their inputs', () => {
    const a = { x: 1, y: 2 };
    const b = { x: 3, y: -1 };

    expect(scale(a, 3)).toEqual({ x: 3, y: 6 });
    expect(add(a, b)).toEqual({ x: 4, y: 1 });
    expect(sub(a, b)).toEqual({ x: -2, y: 3 });
    expect(a).toEqual({ x: 1, y: 2 });
    expect(b).toEqual({ x: 3, y: -1 });
  });
});

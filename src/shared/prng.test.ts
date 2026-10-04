import { describe, expect, it } from 'vitest';
import { nextFloat, nextInt, nextU32, pick, seedRng } from './prng';

const draw = <T>(count: number, next: () => T): T[] => Array.from({ length: count }, () => next());

describe('seedRng', () => {
  it('reproduces the sfc32 reference sequence for a seed', () => {
    const rng = seedRng(42);

    const values = draw(5, () => nextU32(rng));

    expect(values).toEqual([1264412219, 1947509147, 3919439299, 1251167922, 656401615]);
  });

  it('reproduces the reference sequence at both ends of the seed range', () => {
    const low = seedRng(0);
    const high = seedRng(0xffffffff);

    const lowValues = draw(2, () => nextU32(low));
    const highValues = draw(2, () => nextU32(high));

    expect(lowValues).toEqual([1363572419, 145230303]);
    expect(highValues).toEqual([1984736529, 3747275468]);
  });

  it('gives the same sequence to two generators seeded alike', () => {
    const first = seedRng(7);
    const second = seedRng(7);

    const firstValues = draw(100, () => nextU32(first));
    const secondValues = draw(100, () => nextU32(second));

    expect(firstValues).toEqual(secondValues);
  });

  it('rejects a seed that is not a 32-bit unsigned integer', () => {
    expect(() => seedRng(-1)).toThrow(RangeError);
    expect(() => seedRng(1.5)).toThrow(RangeError);
    expect(() => seedRng(2 ** 32)).toThrow(RangeError);
    expect(() => seedRng(Number.NaN)).toThrow(RangeError);
  });
});

describe('nextU32', () => {
  it('advances the state in place and keeps every word a 32-bit unsigned integer', () => {
    const rng = seedRng(1);
    const before = { ...rng };

    draw(1000, () => nextU32(rng));

    expect(rng).not.toEqual(before);
    for (const word of [rng.a, rng.b, rng.c, rng.d]) {
      expect(Number.isInteger(word)).toBe(true);
      expect(word).toBeGreaterThanOrEqual(0);
      expect(word).toBeLessThan(2 ** 32);
    }
  });
});

describe('nextFloat', () => {
  it('stays in [0, 1)', () => {
    const rng = seedRng(3);

    const values = draw(10_000, () => nextFloat(rng));

    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });
});

describe('nextInt', () => {
  it('covers every value of [0, max) and nothing else', () => {
    const rng = seedRng(5);

    const values = new Set(draw(1000, () => nextInt(rng, 6)));

    expect(values).toEqual(new Set([0, 1, 2, 3, 4, 5]));
  });

  it('always returns 0 when the bound is 1', () => {
    const rng = seedRng(5);

    const values = new Set(draw(100, () => nextInt(rng, 1)));

    expect(values).toEqual(new Set([0]));
  });

  it('rejects a bound that is not a positive integer', () => {
    const rng = seedRng(5);

    expect(() => nextInt(rng, 0)).toThrow(RangeError);
    expect(() => nextInt(rng, -3)).toThrow(RangeError);
    expect(() => nextInt(rng, 2.5)).toThrow(RangeError);
  });
});

describe('pick', () => {
  it('reaches every item of the list', () => {
    const rng = seedRng(9);
    const items = ['kick', 'snare', 'hat'] as const;

    const picked = new Set(draw(200, () => pick(rng, items)));

    expect(picked).toEqual(new Set(items));
  });

  it('rejects an empty list', () => {
    const rng = seedRng(9);

    expect(() => pick(rng, [])).toThrow(RangeError);
  });
});

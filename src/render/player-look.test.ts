import { describe, expect, it } from 'vitest';
import { angleSpring, angleTo, spring } from './player-look';

describe('spring', () => {
  it('settles on its target even when the images come three ticks apart', () => {
    const values = new Float64Array([0, 0]);

    for (let image = 0; image < 200; image += 1) {
      spring(values, 0, 7, 0.6, 0.35, 3);
    }

    expect(values[0]).toBeCloseTo(7, 6);
  });

  it('takes the shortest way round on an angle', () => {
    const values = new Float64Array([3, 0]);

    for (let image = 0; image < 200; image += 1) {
      angleSpring(values, 0, -3, 0.3, 0.38, 3);
    }

    expect(angleTo(values[0] ?? 0, -3)).toBeCloseTo(0, 6);
    expect(values[0]).toBeGreaterThan(3);
  });
});

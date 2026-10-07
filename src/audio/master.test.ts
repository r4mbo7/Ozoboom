import { describe, expect, it } from 'vitest';
import { CLIP_CEILING, CLIP_KNEE, loudness, softClipCurve } from './master';

describe('softClipCurve', () => {
  const curve = softClipCurve(2001);
  const at = (x: number) => curve[Math.round(((x + 1) / 2) * (curve.length - 1))] ?? Number.NaN;

  it('leaves the signal untouched below the knee', () => {
    expect(at(0)).toBe(0);
    expect(at(0.5)).toBeCloseTo(0.5, 6);
    expect(at(-CLIP_KNEE)).toBeCloseTo(-CLIP_KNEE, 6);
  });

  it('never reaches full scale, even for an input beyond it', () => {
    const peak = Math.max(...curve.map(Math.abs));

    expect(peak).toBeLessThan(CLIP_CEILING);
    expect(peak).toBeLessThan(1);
    expect(at(1)).toBeGreaterThan(0.9);
  });

  it('rises monotonically and symmetrically', () => {
    for (let index = 1; index < curve.length; index += 1) {
      expect(curve[index]).toBeGreaterThan(curve[index - 1] ?? Number.POSITIVE_INFINITY);
    }
    expect(at(0.85)).toBeCloseTo(-at(-0.85), 6);
  });
});

describe('loudness', () => {
  it('plays the full level untouched and silences the lowest', () => {
    expect(loudness(1)).toBe(1);
    expect(loudness(0)).toBe(0);
  });

  it('lowers the gain faster than the level, as the ear hears it', () => {
    expect(loudness(0.5)).toBeCloseTo(0.25, 6);
    expect(loudness(0.1)).toBeCloseTo(0.01, 6);
  });
});

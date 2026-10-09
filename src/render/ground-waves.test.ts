import { describe, expect, it } from 'vitest';
import { groundWave } from './ground-waves';

describe('groundWave', () => {
  it('has no wave and a natural saturation at intensity 0', () => {
    const wave = groundWave(0, false, 100);

    expect(wave.amplitude).toBe(0);
    expect(wave.saturation).toBe(1);
  });

  it('waves and saturates in proportion to the intensity', () => {
    const half = groundWave(0.5, false, 100);
    const full = groundWave(1, false, 100);

    expect(half.amplitude).toBeCloseTo(full.amplitude / 2);
    expect(half.saturation).toBeLessThan(full.saturation);
  });

  it('blends the hue shift in with the intensity, so it rises and falls with the drop', () => {
    expect(groundWave(0, false, 100).blend).toBe(0);
    expect(groundWave(0.25, false, 100).blend).toBe(0.25);
    expect(groundWave(1, true, 100).blend).toBe(1);
  });

  it('cycles the hue over time', () => {
    expect(groundWave(1, false, 200).hue).not.toBe(groundWave(1, false, 100).hue);
  });

  it('keeps a fixed hue and slower waves in calm mode', () => {
    const early = groundWave(1, true, 100);
    const late = groundWave(1, true, 200);
    const lively = groundWave(1, false, 200);

    expect(late.hue).toBe(early.hue);
    expect(late.phase - early.phase).toBeLessThan((lively.phase * 100) / 200);
  });
});

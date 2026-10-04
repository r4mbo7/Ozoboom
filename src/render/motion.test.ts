import { describe, expect, it } from 'vitest';
import { TICK_RATE_HZ, TICKS_PER_BAR } from '../shared/tempo';
import { FlashLimiter, MAX_FLASHES_PER_SECOND, beatEnvelope, lerp } from './motion';

describe('lerp', () => {
  it('draws an entity between its previous and current positions', () => {
    const previous = 100;
    const current = 140;

    expect(lerp(previous, current, 0)).toBe(100);
    expect(lerp(previous, current, 0.25)).toBe(110);
    expect(lerp(previous, current, 1)).toBe(140);
  });
});

describe('beatEnvelope', () => {
  it('peaks on the beat and fades out over half a bar', () => {
    const halfBar = TICKS_PER_BAR / 2;

    expect(beatEnvelope(0)).toBe(1);
    expect(beatEnvelope(halfBar / 2)).toBeCloseTo(0.25, 6);
    expect(beatEnvelope(halfBar)).toBe(0);
    expect(beatEnvelope(-1)).toBe(0);
  });

  it('only decreases between two beats', () => {
    const samples = Array.from({ length: 48 }, (_, index) => beatEnvelope(index / 2));

    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeLessThanOrEqual(samples[index - 1] ?? 1);
    }
  });
});

describe('FlashLimiter', () => {
  it('never lets more than three flashes start within one second', () => {
    const limiter = new FlashLimiter();
    const starts: number[] = [];

    for (let tick = 0; tick < TICK_RATE_HZ * 10; tick += 1) {
      if (limiter.tryStart(tick)) {
        starts.push(tick);
      }
    }

    for (const start of starts) {
      const inWindow = starts.filter((tick) => tick >= start && tick < start + TICK_RATE_HZ);
      expect(inWindow.length).toBeLessThanOrEqual(MAX_FLASHES_PER_SECOND);
    }
    expect(starts.length).toBeGreaterThanOrEqual(MAX_FLASHES_PER_SECOND * 9);
  });
});

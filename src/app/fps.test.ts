import { describe, expect, it } from 'vitest';
import { createFpsMeter } from './fps';

function feed(meter: ReturnType<typeof createFpsMeter>, times: readonly number[]): void {
  for (const time of times) {
    meter.frame(time);
  }
}

describe('createFpsMeter', () => {
  it('knows nothing before two frames', () => {
    const meter = createFpsMeter();

    meter.frame(1000);

    expect(meter.average()).toBeNull();
  });

  it('averages the frames over the time they took', () => {
    const meter = createFpsMeter();

    feed(meter, [0, 20, 40, 60, 80, 100]);

    expect(meter.average()).toBe(50);
  });

  it('weighs a slow stretch by its duration, not by its frame count', () => {
    const meter = createFpsMeter();

    feed(meter, [0, 10, 20, 30, 40, 140, 240]);

    expect(meter.average()).toBeCloseTo(6 / 0.24);
  });

  it('skips the gap of a hidden tab, when no frame is drawn', () => {
    const meter = createFpsMeter();

    feed(meter, [0, 20, 40, 60_040, 60_060]);

    expect(meter.average()).toBe(50);
  });
});

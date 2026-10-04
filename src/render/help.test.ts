import { describe, expect, it } from 'vitest';
import { RING_STEPS, ringStep } from './help';

describe('ringStep', () => {
  it('is empty before the help starts and full when it is done', () => {
    expect(ringStep(0, 48)).toBe(0);
    expect(ringStep(48, 48)).toBe(RING_STEPS);
  });

  it('follows helpTicks, never going back as it grows', () => {
    const steps = Array.from({ length: 49 }, (_, ticks) => ringStep(ticks, 48));

    expect(steps[24]).toBe(RING_STEPS / 2);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });

  it('stays inside the ring for out of range values', () => {
    expect(ringStep(-3, 48)).toBe(0);
    expect(ringStep(99, 48)).toBe(RING_STEPS);
    expect(ringStep(5, 0)).toBe(0);
  });
});

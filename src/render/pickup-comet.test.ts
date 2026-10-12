import { describe, expect, it } from 'vitest';
import {
  CALM_TRAIL_STEPS,
  POP_TICKS,
  TRAIL_STEPS,
  cometPop,
  cometStretch,
  isAttracted,
  trailSteps,
} from './pickup-comet';

describe('a vibe on its way to a player', () => {
  it('is attracted once it has moved since the previous step', () => {
    const resting = { prevX: 40, prevY: 60, x: 40, y: 60 };
    const sideways = { prevX: 40, prevY: 60, x: 52, y: 60 };
    const upwards = { prevX: 40, prevY: 60, x: 40, y: 48 };

    expect(isAttracted(resting)).toBe(false);
    expect(isAttracted(sideways)).toBe(true);
    expect(isAttracted(upwards)).toBe(true);
  });

  it('leaves a trail no longer than its flight so far, capped at its full length', () => {
    const justLeft = trailSteps(0.5, false);
    const longGone = trailSteps(40, false);

    expect(trailSteps(0, false)).toBe(0);
    expect(justLeft).toBe(0.5);
    expect(longGone).toBe(TRAIL_STEPS);
  });

  it('leaves a shorter trail in calm mode', () => {
    const calm = trailSteps(40, true);

    expect(calm).toBe(CALM_TRAIL_STEPS);
    expect(calm).toBeLessThan(TRAIL_STEPS);
  });

  it('never draws a trail backwards when the clock goes back', () => {
    expect(trailSteps(-3, false)).toBe(0);
    expect(trailSteps(-3, true)).toBe(0);
  });

  it('pops as it leaves, then settles back to its size', () => {
    const leaving = cometPop(0, false);
    const halfway = cometPop(POP_TICKS / 2, false);
    const settled = cometPop(POP_TICKS, false);

    expect(leaving).toBeCloseTo(1.6);
    expect(halfway).toBeGreaterThan(1);
    expect(halfway).toBeLessThan(leaving);
    expect(settled).toBe(1);
    expect(cometPop(POP_TICKS * 4, false)).toBe(1);
  });

  it('stretches along its flight and thins across it', () => {
    const { along, across } = cometStretch(false);

    expect(along).toBeCloseTo(1.55);
    expect(across).toBeCloseTo(0.72);
  });

  it('neither pops nor stretches in calm mode', () => {
    expect(cometPop(0, true)).toBe(1);
    expect(cometStretch(true)).toEqual({ along: 1, across: 1 });
  });
});

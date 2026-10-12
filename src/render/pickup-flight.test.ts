import { describe, expect, it } from 'vitest';
import type { PickupState } from '../sim/state';
import { ARC_HEIGHT, flightPose } from './pickup-flight';

function vibe(flight?: PickupState['flight']): PickupState {
  const base = { id: 1, kind: 'vibes' as const, amount: 0.25, ticksLeft: 100 };
  return { ...base, x: 500, y: 400, prevX: 500, prevY: 400, ...(flight && { flight }) };
}

const from = { fromX: 100, fromY: 400 };

describe('flightPose', () => {
  it('leaves its speaker, peaks halfway and comes down on its landing spot', () => {
    const start = flightPose(vibe({ ...from, ticks: 24, ticksLeft: 24 }), 0, false);
    const middle = flightPose(vibe({ ...from, ticks: 24, ticksLeft: 12 }), 0, false);
    const end = flightPose(vibe({ ...from, ticks: 24, ticksLeft: 1 }), 1, false);

    expect(start).toMatchObject({ x: 100, y: 400, progress: 0 });
    expect(middle.x).toBe(300);
    expect(middle.y).toBeCloseTo(400 - ARC_HEIGHT);
    expect(middle.scale).toBeGreaterThan(1);
    expect(end.x).toBe(500);
    expect(end.y).toBeCloseTo(400);
    expect(end.scale).toBeCloseTo(1);
  });

  it('moves between two steps', () => {
    const flying = vibe({ ...from, ticks: 24, ticksLeft: 12 });

    expect(flightPose(flying, 0.5, false).x).toBeGreaterThan(flightPose(flying, 0, false).x);
  });

  it('fades in on its landing spot in calm mode, without flying', () => {
    const pose = flightPose(vibe({ ...from, ticks: 24, ticksLeft: 18 }), 0, true);

    expect(pose).toMatchObject({ x: 500, y: 400, scale: 1, alpha: 0.25 });
  });

  it('follows the vibe once it has landed', () => {
    const landed = { ...vibe(), prevX: 480 };

    expect(flightPose(landed, 0.5, false)).toEqual({
      x: 490,
      y: 400,
      scale: 1,
      alpha: 1,
      progress: 1,
    });
  });
});

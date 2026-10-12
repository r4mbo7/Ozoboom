import type { Positioned } from '../sim/state';

// In steps of the flight: the vibe covers one per tick.
export const TRAIL_STEPS = 5;
export const CALM_TRAIL_STEPS = 2;
export const POP_TICKS = 3.5;
const POP_GAIN = 0.6;

export interface Stretch {
  readonly along: number;
  readonly across: number;
}

const ROUND: Stretch = { along: 1, across: 1 };
const FLOWN: Stretch = { along: 1.55, across: 0.72 };

// A pickup only moves when a player attracts it.
export function isAttracted(pickup: Positioned): boolean {
  return pickup.x !== pickup.prevX || pickup.y !== pickup.prevY;
}

export function trailSteps(elapsedTicks: number, calm: boolean): number {
  return Math.max(0, Math.min(elapsedTicks, calm ? CALM_TRAIL_STEPS : TRAIL_STEPS));
}

export function cometPop(elapsedTicks: number, calm: boolean): number {
  if (calm) {
    return 1;
  }
  return 1 + POP_GAIN * Math.min(1, Math.max(0, 1 - elapsedTicks / POP_TICKS));
}

export function cometStretch(calm: boolean): Stretch {
  return calm ? ROUND : FLOWN;
}

import { TICKS_PER_BEAT, TICK_MS } from '../shared/tempo';

export const TICK_SECONDS = TICK_MS / 1000;
export const STEP_TICKS = TICKS_PER_BEAT / 4;
export const LOOKAHEAD_SECONDS = 2 * TICKS_PER_BEAT * TICK_SECONDS;
export const DRIFT_TOLERANCE_SECONDS = 0.015;
export const MAX_SLEW_SECONDS = 0.002;
export const RESYNC_SECONDS = 0.1;
export const LATE_TOLERANCE_SECONDS = 0.05;

const STEP_EPSILON = 1e-6;

export interface Anchor {
  readonly tick: number;
  readonly time: number;
}

export interface Follow {
  readonly anchor: Anchor;
  readonly resynced: boolean;
}

export interface StepRange {
  readonly from: number;
  readonly until: number;
}

export function tickToTime(anchor: Anchor, tick: number): number {
  return anchor.time + (tick - anchor.tick) * TICK_SECONDS;
}

export function timeToTick(anchor: Anchor, time: number): number {
  return anchor.tick + (time - anchor.time) / TICK_SECONDS;
}

export function firstStepAtOrAfter(tick: number): number {
  const step = Math.ceil(tick / STEP_TICKS - STEP_EPSILON) * STEP_TICKS;
  return step === 0 ? 0 : step; // turns -0 into 0
}

export function follow(anchor: Anchor | null, tick: number, now: number): Follow {
  if (anchor === null) {
    return { anchor: { tick, time: now }, resynced: true };
  }
  const drift = now - tickToTime(anchor, tick);
  const size = Math.abs(drift);
  if (size > RESYNC_SECONDS) {
    return { anchor: { tick, time: now }, resynced: true };
  }
  if (size <= DRIFT_TOLERANCE_SECONDS) {
    return { anchor, resynced: false };
  }
  const slew = Math.sign(drift) * Math.min(size - DRIFT_TOLERANCE_SECONDS, MAX_SLEW_SECONDS);
  return { anchor: { tick: anchor.tick, time: anchor.time + slew }, resynced: false };
}

export function stepsToSchedule(
  anchor: Anchor,
  cursor: number,
  earliest: number,
  horizon: number,
): StepRange {
  const from = Math.max(
    firstStepAtOrAfter(cursor),
    firstStepAtOrAfter(timeToTick(anchor, earliest)),
  );
  const until = Math.max(from, firstStepAtOrAfter(timeToTick(anchor, horizon)));
  return { from, until };
}

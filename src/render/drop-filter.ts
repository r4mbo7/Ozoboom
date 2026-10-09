import { TICKS_PER_BAR, TICKS_PER_PHRASE } from '../shared/tempo';
import type { SimState } from '../sim/state';

export type DropClock = Pick<SimState, 'status'> & {
  set: Pick<SimState['set'], 'tier' | 'segment' | 'segmentStartTick'>;
};

const RISE_TICKS = TICKS_PER_BAR;
const HOLD_TICKS = TICKS_PER_PHRASE;
const FALL_TICKS = 4 * TICKS_PER_BAR;
const FIRST_DROP_PEAK = 0.5;

// 0 outside a drop; rises over a bar, holds a phrase, falls over four bars, even if a boss keeps the drop going.
export function dropFilterIntensity(state: DropClock, now: number): number {
  if (state.status === 'won' || state.set.segment !== 'drop') {
    return 0;
  }
  const elapsed = now - state.set.segmentStartTick;
  const peak = state.set.tier === 0 ? FIRST_DROP_PEAK : 1;
  if (elapsed <= 0) {
    return 0;
  }
  if (elapsed < RISE_TICKS) {
    return (peak * elapsed) / RISE_TICKS;
  }
  const falling = elapsed - RISE_TICKS - HOLD_TICKS;
  if (falling <= 0) {
    return peak;
  }
  return falling >= FALL_TICKS ? 0 : peak * (1 - falling / FALL_TICKS);
}

import { TICK_MS, TICKS_PER_BEAT } from '../shared/tempo';

const DEFEAT_BEATS = 6;

// The ticks a finished game stays on screen before its end screen opens: a defeat lets the player
// see the scene fall silent.
export function endingTicks(outcome: 'won' | 'lost'): number {
  return outcome === 'lost' ? DEFEAT_BEATS * TICKS_PER_BEAT : 0;
}

export function endingMs(outcome: 'won' | 'lost', speed: number): number {
  return (endingTicks(outcome) * TICK_MS) / speed;
}

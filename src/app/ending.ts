import { TICK_MS, type Tempo } from '../shared/tempo';

const DEFEAT_BEATS = 6;
const VICTORY_BEATS = 4;

// The ticks a finished game stays on screen before its end screen opens, in beats of its set: a
// defeat lets the player see the scene fall silent, a win lets the last boss burst into colors.
export function endingTicks(outcome: 'won' | 'lost', tempo: Pick<Tempo, 'ticksPerBeat'>): number {
  return (outcome === 'lost' ? DEFEAT_BEATS : VICTORY_BEATS) * tempo.ticksPerBeat;
}

export function endingMs(
  outcome: 'won' | 'lost',
  tempo: Pick<Tempo, 'ticksPerBeat'>,
  speed: number,
): number {
  return (endingTicks(outcome, tempo) * TICK_MS) / speed;
}

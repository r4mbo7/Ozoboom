import {
  barOfTick,
  beatOfTick,
  isBarTick,
  isBeatTick,
  isPhraseTick,
  phraseOfTick,
} from '../../shared/tempo';
import { isSetFinished } from './set-progress';
import type { StepContext } from './types';

export function tempo({ state, tempo: grid, set: definition }: StepContext): void {
  const { tick, set, events } = state;
  if (!isBeatTick(tick, grid)) {
    return;
  }
  set.beat = beatOfTick(tick, grid);
  events.push({ type: 'beat', beat: set.beat });
  if (!isBarTick(tick, grid)) {
    return;
  }
  set.bar = barOfTick(tick, grid);
  events.push({ type: 'bar', bar: set.bar });
  if (!isPhraseTick(tick, grid)) {
    return;
  }
  set.phrase = phraseOfTick(tick, grid);
  // The game freezes once lost, so each phrase started past a set's first is one held to its end, set after set;
  // a set held, or without tiers, has nothing left to hold.
  if (set.phrase > 0 && !isSetFinished(set, definition)) {
    state.stats.phrasesHeld += 1;
  }
  events.push({ type: 'phrase', phrase: set.phrase });
}

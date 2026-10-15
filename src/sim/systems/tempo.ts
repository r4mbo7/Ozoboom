import {
  barOfTick,
  beatOfTick,
  isBarTick,
  isBeatTick,
  isPhraseTick,
  phraseOfTick,
} from '../../shared/tempo';
import type { StepContext } from './types';

export function tempo({ state, tempo: grid }: StepContext): void {
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
  // The game freezes once lost, so the phrases started are the phrases held to their end.
  state.stats.phrasesHeld = set.phrase;
  events.push({ type: 'phrase', phrase: set.phrase });
}

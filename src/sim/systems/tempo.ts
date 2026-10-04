import {
  barOfTick,
  beatOfTick,
  isBarTick,
  isBeatTick,
  isPhraseTick,
  phraseOfTick,
} from '../../shared/tempo';
import type { StepContext } from './types';

export function tempo({ state }: StepContext): void {
  const { tick, set, events } = state;
  if (!isBeatTick(tick)) {
    return;
  }
  set.beat = beatOfTick(tick);
  events.push({ type: 'beat', beat: set.beat });
  if (!isBarTick(tick)) {
    return;
  }
  set.bar = barOfTick(tick);
  events.push({ type: 'bar', bar: set.bar });
  if (!isPhraseTick(tick)) {
    return;
  }
  set.phrase = phraseOfTick(tick);
  events.push({ type: 'phrase', phrase: set.phrase });
}

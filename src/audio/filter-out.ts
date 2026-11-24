import { clamp01 } from '../shared/scalar';
import type { Tempo } from '../shared/tempo';
import type { SimState } from '../sim/state';
import { dropEndTick } from '../sim/systems/set-progress';
import { tickToTime, timeToTick, type Anchor } from './clock';
import { OPEN_HZ } from './music-score';
import { CUT_SECONDS } from './music-step';

const FALL_HZ = 8000;
const SHUT_HZ = 250;
const Q = 0.7;

export interface FilterOut {
  readonly filter: BiquadFilterNode;
  // From the fall of a drop's last boss to the bar line its drop ends on, on the tick of the set.
  follow(state: SimState, clock: Anchor, tempo: Tempo, currentTime: number): void;
  open(currentTime: number): void;
}

function cutoff(fell: number, end: number, tick: number): number {
  return FALL_HZ * (SHUT_HZ / FALL_HZ) ** clamp01((tick - fell) / (end - fell));
}

export function createFilterOut(context: BaseAudioContext): FilterOut {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = OPEN_HZ;
  filter.Q.value = Q;
  const { frequency } = filter;
  let closing = false;
  let followedTick = -1;

  function open(currentTime: number) {
    if (closing) {
      closing = false;
      frequency.cancelScheduledValues(currentTime);
      frequency.setValueAtTime(OPEN_HZ, currentTime);
    }
  }

  return {
    filter,
    open,
    // Shut on the bar line, it opens on the update the set passes it, over the cut of the drop's
    // bus: the drop's notes scheduled ahead past the line play until that cut ends.
    follow(state, clock, tempo, currentTime) {
      // The clock is only followed again once the tick moves: after a choice, its first update
      // still carries the time the choice took.
      const moved = state.tick !== followedTick;
      followedTick = state.tick;
      const fell = state.set.bossesDownTick;
      const end = dropEndTick(state.set, tempo);
      if (fell === undefined || end === null) {
        if (closing) {
          closing = false;
          frequency.cancelScheduledValues(currentTime);
          frequency.setValueAtTime(SHUT_HZ, currentTime);
          frequency.exponentialRampToValueAtTime(OPEN_HZ, currentTime + CUT_SECONDS);
        }
        return;
      }
      closing = true;
      frequency.cancelScheduledValues(currentTime);
      const frozen = state.status !== 'running' || !moved;
      if (frozen) {
        frequency.setValueAtTime(cutoff(fell, end, state.tick), currentTime);
        return;
      }
      frequency.setValueAtTime(cutoff(fell, end, timeToTick(clock, currentTime)), currentTime);
      const endsAt = tickToTime(clock, end);
      if (endsAt > currentTime) {
        frequency.exponentialRampToValueAtTime(SHUT_HZ, endsAt);
      }
    },
  };
}

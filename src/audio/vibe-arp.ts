import { barOfTick, type Tempo } from '../shared/tempo';
import {
  LATE_TOLERANCE_SECONDS,
  TICK_SECONDS,
  beatSeconds,
  firstStepAtOrAfter,
  sixteenthSeconds,
  tickToTime,
  timeToTick,
  type Anchor,
} from './clock';

// Degrees above the chord root: two octaves up, then back down.
const ARPEGGIO = [0, 2, 4, 7, 9, 11, 14, 11, 9, 7, 4, 2];
const MAX_VIBES = 5;
const STREAK_BEATS = 2;

export interface VibeNote {
  readonly at: number;
  readonly bar: number;
  readonly degree: number;
  readonly vibes: number;
}

export interface VibeArp {
  // Without an anchor no set plays, and the note does not wait.
  collect(vibes: number, now: number, tempo: Tempo, anchor: Anchor | null): VibeNote | null;
}

export function createVibeArp(): VibeArp {
  let pending = 0;
  let streak = 0;
  let collectedAt = -Infinity;
  let consumed = -Infinity;

  // Once the next call would come too late to schedule it.
  function dueStep(now: number, tempo: Tempo, anchor: Anchor): { at: number; bar: number } | null {
    const earliest = Math.max(now - LATE_TOLERANCE_SECONDS, consumed + sixteenthSeconds(tempo) / 2);
    const step = firstStepAtOrAfter(
      timeToTick(anchor, earliest),
      tempo.ticksPerBeat / 4,
      tempo.originTick,
    );
    const time = tickToTime(anchor, step);
    if (time >= now + TICK_SECONDS) {
      return null;
    }
    consumed = time;
    return { at: Math.max(time, now), bar: barOfTick(step, tempo) };
  }

  return {
    collect(vibes, now, tempo, anchor) {
      if (now - collectedAt > STREAK_BEATS * beatSeconds(tempo)) {
        streak = 0;
        pending = 0;
      }
      if (vibes > 0) {
        collectedAt = now;
        pending += vibes;
      }
      const due = anchor === null ? { at: now, bar: 0 } : dueStep(now, tempo, anchor);
      if (due === null || pending === 0) {
        return null;
      }
      const note = {
        ...due,
        degree: ARPEGGIO[streak % ARPEGGIO.length] ?? 0,
        vibes: Math.min(pending, MAX_VIBES),
      };
      streak += 1;
      pending = 0;
      return note;
    },
  };
}

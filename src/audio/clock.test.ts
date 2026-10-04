import { describe, expect, it } from 'vitest';
import { TICKS_PER_BEAT } from '../shared/tempo';
import {
  DRIFT_TOLERANCE_SECONDS,
  LATE_TOLERANCE_SECONDS,
  LOOKAHEAD_SECONDS,
  MAX_SLEW_SECONDS,
  RESYNC_SECONDS,
  STEP_TICKS,
  TICK_SECONDS,
  firstStepAtOrAfter,
  follow,
  stepsToSchedule,
  tickToTime,
  timeToTick,
  type Anchor,
} from './clock';

describe('tick anchoring', () => {
  it('maps ticks to audio time and back around the anchor', () => {
    const anchor: Anchor = { tick: 100, time: 3 };

    expect(tickToTime(anchor, 100)).toBe(3);
    expect(tickToTime(anchor, 129)).toBeCloseTo(4, 9);
    expect(tickToTime(anchor, 71)).toBeCloseTo(2, 9);
    expect(timeToTick(anchor, tickToTime(anchor, 457))).toBeCloseTo(457, 9);
  });

  it('runs at 29 ticks per second, a sixteenth note every 3 ticks', () => {
    expect(1 / TICK_SECONDS).toBeCloseTo(29, 9);
    expect(STEP_TICKS).toBe(3);
  });

  it('rounds a tick up to the next sixteenth', () => {
    expect(firstStepAtOrAfter(0)).toBe(0);
    expect(firstStepAtOrAfter(1)).toBe(3);
    expect(firstStepAtOrAfter(3)).toBe(3);
    expect(firstStepAtOrAfter(3.0000000001)).toBe(3);
    expect(firstStepAtOrAfter(5.9)).toBe(6);
  });
});

describe('follow', () => {
  it('anchors the first tick to now', () => {
    const result = follow(null, 42, 7.5);

    expect(result).toEqual({ anchor: { tick: 42, time: 7.5 }, resynced: true });
  });

  it('keeps the anchor while the drift stays within 15 ms', () => {
    const anchor: Anchor = { tick: 0, time: 1 };
    const now = tickToTime(anchor, 290) + DRIFT_TOLERANCE_SECONDS * 0.99;

    const result = follow(anchor, 290, now);

    expect(result.anchor).toBe(anchor);
    expect(result.resynced).toBe(false);
  });

  it('slews the anchor softly toward late ticks beyond 15 ms', () => {
    const anchor: Anchor = { tick: 0, time: 1 };
    const now = tickToTime(anchor, 290) + 0.05;

    const result = follow(anchor, 290, now);

    expect(result.resynced).toBe(false);
    expect(result.anchor.tick).toBe(0);
    expect(result.anchor.time - anchor.time).toBeCloseTo(MAX_SLEW_SECONDS, 12);
  });

  it('slews toward early ticks too, never past the tolerance edge', () => {
    const anchor: Anchor = { tick: 0, time: 1 };
    const now = tickToTime(anchor, 290) - DRIFT_TOLERANCE_SECONDS - 0.0005;

    const result = follow(anchor, 290, now);

    expect(result.anchor.time - anchor.time).toBeCloseTo(-0.0005, 12);
  });

  it('resyncs at once when the drift exceeds 100 ms', () => {
    const anchor: Anchor = { tick: 0, time: 1 };
    const now = tickToTime(anchor, 290) + RESYNC_SECONDS + 0.001;

    const result = follow(anchor, 290, now);

    expect(result).toEqual({ anchor: { tick: 290, time: now }, resynced: true });
  });
});

describe('stepsToSchedule', () => {
  const anchor: Anchor = { tick: 0, time: 10 };

  it('covers two beats ahead of now', () => {
    const now = 10;

    const range = stepsToSchedule(anchor, 0, now - LATE_TOLERANCE_SECONDS, now + LOOKAHEAD_SECONDS);

    expect(range).toEqual({ from: 0, until: 2 * TICKS_PER_BEAT });
  });

  it('resumes from the cursor without scheduling a step twice', () => {
    const now = tickToTime(anchor, 7);

    const range = stepsToSchedule(
      anchor,
      24,
      now - LATE_TOLERANCE_SECONDS,
      now + LOOKAHEAD_SECONDS,
    );

    expect(range.from).toBe(24);
    expect(range.until).toBe(33);
  });

  it('drops steps that are already too late to play', () => {
    const now = tickToTime(anchor, 30);

    const range = stepsToSchedule(anchor, 0, now - LATE_TOLERANCE_SECONDS, now + LOOKAHEAD_SECONDS);

    expect(range.from).toBe(30);
    expect(tickToTime(anchor, range.from)).toBeGreaterThanOrEqual(now - LATE_TOLERANCE_SECONDS);
  });

  it('returns an empty range when the cursor is beyond the horizon', () => {
    const range = stepsToSchedule(anchor, 99, 10, 10 + LOOKAHEAD_SECONDS);

    expect(range.from).toBe(99);
    expect(range.until).toBe(99);
  });
});

interface Session {
  seconds: number;
  frameHz: number;
  clockSkew: number;
  audioQuantum: number;
  maxTicksPerFrame: number;
  stalls: readonly { at: number; seconds: number }[];
}

interface SessionResult {
  resyncs: number;
  offsets: { tick: number; arrival: number; offset: number }[];
}

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function runSession(session: Session): SessionResult {
  const random = lcg(7);
  const kicks = new Map<number, number>();
  const offsets: SessionResult['offsets'] = [];
  const audioNow = (wall: number) =>
    Math.floor((wall * (1 + session.clockSkew) + 0.25) / session.audioQuantum) *
    session.audioQuantum;
  let anchor: Anchor | null = null;
  let cursor = 0;
  let resyncs = 0;
  let tick = 0;
  let accumulator = 0;
  let wall = 0;
  let stallIndex = 0;

  const update = (now: number) => {
    const followed = follow(anchor, tick, now);
    anchor = followed.anchor;
    if (followed.resynced) {
      resyncs += 1;
      cursor = firstStepAtOrAfter(tick);
    }
    const range = stepsToSchedule(
      anchor,
      cursor,
      now - LATE_TOLERANCE_SECONDS,
      now + LOOKAHEAD_SECONDS,
    );
    for (let step = range.from; step < range.until; step += STEP_TICKS) {
      if (step % TICKS_PER_BEAT === 0) {
        kicks.set(step, tickToTime(anchor, step));
      }
    }
    cursor = range.until;
  };

  while (wall < session.seconds) {
    let frame = 1 / session.frameHz + (random() - 0.5) * 0.002;
    const stall = session.stalls[stallIndex];
    if (stall !== undefined && wall >= stall.at) {
      frame += stall.seconds;
      stallIndex += 1;
    }
    wall += frame;
    accumulator += frame;
    const now = audioNow(wall);
    const arrived: number[] = [];
    let stepped = 0;
    while (accumulator >= TICK_SECONDS && stepped < session.maxTicksPerFrame) {
      accumulator -= TICK_SECONDS;
      tick += 1;
      stepped += 1;
      if (tick % TICKS_PER_BEAT === 0) {
        arrived.push(tick);
      }
    }
    if (stepped === session.maxTicksPerFrame) {
      accumulator = 0;
    }
    if (stepped > 0) {
      update(now);
    }
    for (const beatTick of arrived) {
      const kick = kicks.get(beatTick);
      if (kick !== undefined) {
        offsets.push({ tick: beatTick, arrival: now, offset: kick - now });
      }
    }
  }
  return { resyncs, offsets };
}

const fiveMinutes: Session = {
  seconds: 300,
  frameHz: 60,
  clockSkew: 1e-4,
  audioQuantum: 256 / 48_000,
  maxTicksPerFrame: 8,
  stalls: [],
};

function worstOffset(offsets: SessionResult['offsets']): number {
  return Math.max(...offsets.map(({ offset }) => Math.abs(offset)));
}

describe('a five minute session', () => {
  it('keeps every kick within 20 ms of its beat tick at 60 frames per second', () => {
    const result = runSession(fiveMinutes);

    expect(result.resyncs).toBe(1);
    expect(result.offsets.length).toBeGreaterThan(700);
    expect(worstOffset(result.offsets)).toBeLessThan(0.02);
  });

  it('holds on a 30 Hz display and a fast audio clock', () => {
    const result = runSession({ ...fiveMinutes, frameHz: 30, clockSkew: 5e-4 });

    expect(result.resyncs).toBe(1);
    expect(worstOffset(result.offsets)).toBeLessThan(0.03);
  });

  it('rides out a short hitch without resyncing', () => {
    const result = runSession({ ...fiveMinutes, stalls: [{ at: 60, seconds: 0.2 }] });
    const afterRecovery = result.offsets.filter(({ arrival }) => arrival > 62);

    expect(result.resyncs).toBe(1);
    expect(worstOffset(afterRecovery)).toBeLessThan(0.02);
  });

  it('resyncs after a pause and is back on the beat right away', () => {
    const result = runSession({ ...fiveMinutes, stalls: [{ at: 60, seconds: 5 }] });
    const afterPause = result.offsets.filter(({ arrival }) => arrival > 65.3);

    expect(result.resyncs).toBe(2);
    expect(worstOffset(afterPause)).toBeLessThan(0.02);
  });
});

import { describe, expect, it } from 'vitest';
import {
  BEATS_PER_BAR,
  DEFAULT_BPM,
  TICKS_PER_BAR,
  TICKS_PER_BEAT,
  TICKS_PER_PHRASE,
  TICK_MS,
  TICK_RATE_HZ,
  barOfTick,
  beatOfTick,
  beatPeriodMs,
  isBarTick,
  isBeatTick,
  phraseOfTick,
} from './tempo';

describe('beatPeriodMs', () => {
  it('derives the beat period from the tempo', () => {
    expect(beatPeriodMs(150)).toBe(400);
  });

  it('rejects a tempo that is not positive', () => {
    expect(() => beatPeriodMs(0)).toThrow(RangeError);
    expect(() => beatPeriodMs(-1)).toThrow(RangeError);
    expect(() => beatPeriodMs(Number.NaN)).toThrow(RangeError);
  });
});

describe('tick grid', () => {
  it('is a whole subdivision of the beat at the default tempo', () => {
    expect(TICK_RATE_HZ).toBe(29);
    expect(TICK_MS * TICKS_PER_BEAT).toBeCloseTo(beatPeriodMs(DEFAULT_BPM), 9);
    expect(TICKS_PER_BAR).toBe(TICKS_PER_BEAT * BEATS_PER_BAR);
    expect(TICKS_PER_PHRASE).toBe(TICKS_PER_BAR * 16);
  });

  it('counts beats, bars and phrases from the tick', () => {
    const tick = TICKS_PER_PHRASE * 2 + TICKS_PER_BAR * 3 + TICKS_PER_BEAT * 2 + 5;

    expect(beatOfTick(tick)).toBe(2 * 64 + 3 * 4 + 2);
    expect(barOfTick(tick)).toBe(2 * 16 + 3);
    expect(phraseOfTick(tick)).toBe(2);
  });

  it('flags the first tick of a beat and of a bar', () => {
    expect(isBeatTick(0)).toBe(true);
    expect(isBarTick(0)).toBe(true);
    expect(isBeatTick(TICKS_PER_BEAT)).toBe(true);
    expect(isBarTick(TICKS_PER_BEAT)).toBe(false);
    expect(isBeatTick(TICKS_PER_BEAT + 1)).toBe(false);
    expect(isBarTick(TICKS_PER_BAR)).toBe(true);
  });
});

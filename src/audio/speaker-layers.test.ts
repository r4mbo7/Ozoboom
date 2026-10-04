import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import {
  BREAK_LEVEL,
  MUFFLED_LEVEL,
  OPEN_TICKS,
  SPEAKER_LAYER_IDS,
  entryTickOf,
  isSpeakerLayerId,
  presenceAt,
} from './speaker-layers';

describe('SPEAKER_LAYER_IDS', () => {
  it('names the four speakers of the set, in the order they are drawn', () => {
    expect(SPEAKER_LAYER_IDS).toEqual(['dome-chill', 'foret', 'sub', 'cercle-acid']);
    expect(isSpeakerLayerId('sub')).toBe(true);
    expect(isSpeakerLayerId('inconnue')).toBe(false);
  });
});

describe('entryTickOf', () => {
  it('lands on the beat after the tick the speaker was plugged on', () => {
    expect(entryTickOf(5 * TICKS_PER_BEAT + 3, 0)).toBe(6 * TICKS_PER_BEAT);
  });

  it('never lands on the tick it was plugged on, even right on a beat', () => {
    expect(entryTickOf(5 * TICKS_PER_BEAT, 0)).toBe(6 * TICKS_PER_BEAT);
  });

  it('waits for the first beat that is not scheduled yet', () => {
    const cursor = 5 * TICKS_PER_BEAT + 3;

    expect(entryTickOf(4 * TICKS_PER_BEAT, cursor)).toBe(6 * TICKS_PER_BEAT);
    expect(entryTickOf(4 * TICKS_PER_BEAT, 5 * TICKS_PER_BEAT)).toBe(5 * TICKS_PER_BEAT);
  });
});

describe('presenceAt', () => {
  const entry = 10 * TICKS_PER_BEAT;

  it('announces a speaker that is not in yet quiet and with the filter closed', () => {
    expect(presenceAt(entry - 1, null, false)).toEqual({ level: MUFFLED_LEVEL, open: 0 });
    expect(presenceAt(entry - 1, entry, false)).toEqual({ level: MUFFLED_LEVEL, open: 0 });
  });

  it('enters at full level on its tick and opens the filter over one bar', () => {
    expect(presenceAt(entry, entry, false)).toEqual({ level: 1, open: 0 });
    expect(presenceAt(entry + OPEN_TICKS / 2, entry, false).open).toBeCloseTo(0.5);
    expect(presenceAt(entry + OPEN_TICKS, entry, false)).toEqual({ level: 1, open: 1 });
    expect(OPEN_TICKS).toBe(TICKS_PER_BAR);
  });

  it('stays in the set and lightens in the break like the other layers', () => {
    const lit = presenceAt(entry + OPEN_TICKS, entry, true);

    expect(lit.level).toBe(BREAK_LEVEL);
    expect(lit.open).toBeLessThan(1);
    expect(lit.open).toBeGreaterThan(0);
  });
});

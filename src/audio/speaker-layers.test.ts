import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_BEAT, tempoOf } from '../shared/tempo';
import {
  BREAK_LEVEL,
  MUFFLED_LEVEL,
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
    expect(presenceAt(entry + TICKS_PER_BAR / 2, entry, false).open).toBeCloseTo(0.5);
    expect(presenceAt(entry + TICKS_PER_BAR, entry, false)).toEqual({ level: 1, open: 1 });
  });

  it('opens over one bar of the set that plays it', () => {
    const dome = tempoOf(18);

    expect(presenceAt(dome.ticksPerBar / 2, 0, false, dome).open).toBeCloseTo(0.5);
    expect(entryTickOf(1, 0, dome)).toBe(18);
  });

  it('stays in the set and lightens in the break like the other layers', () => {
    const lit = presenceAt(entry + TICKS_PER_BAR, entry, true);

    expect(lit.level).toBe(BREAK_LEVEL);
    expect(lit.open).toBeLessThan(1);
    expect(lit.open).toBeGreaterThan(0);
  });
});

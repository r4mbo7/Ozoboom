import { describe, expect, it } from 'vitest';
import { DEFAULT_BPM, TICKS_PER_BEAT } from '../shared/tempo';
import {
  AMBIENCE_CHORDS,
  CHORD_EIGHTHS,
  EIGHTH_SECONDS,
  ambienceChordAt,
  ambienceNotesAt,
} from './ambience';
import { TICK_SECONDS } from './clock';
import { ROOT_MIDI } from './scale';

const CYCLE = CHORD_EIGHTHS * AMBIENCE_CHORDS.length;
const everyNote = Array.from({ length: CYCLE }, (_, index) =>
  ambienceNotesAt(index).map((note) => ({ ...note, index })),
).flat();

describe('menu ambience', () => {
  it('runs at half the tempo of the set, its eighth notes on the beats of the set', () => {
    expect(EIGHTH_SECONDS).toBeCloseTo(TICKS_PER_BEAT * TICK_SECONDS, 9);
    expect(60 / (2 * EIGHTH_SECONDS)).toBeCloseTo(DEFAULT_BPM / 2, 9);
  });

  it('changes chord every two bars and loops after four chords, about 26 seconds', () => {
    const chords = [0, 15, 16, 31, 32, 48, CYCLE].map(ambienceChordAt);

    expect(chords).toEqual([
      AMBIENCE_CHORDS[0],
      AMBIENCE_CHORDS[0],
      AMBIENCE_CHORDS[1],
      AMBIENCE_CHORDS[1],
      AMBIENCE_CHORDS[2],
      AMBIENCE_CHORDS[3],
      AMBIENCE_CHORDS[0],
    ]);
    expect(CYCLE * EIGHTH_SECONDS).toBeCloseTo(26.5, 1);
  });

  it('starts the pad and the drone on each chord only, held until the next one', () => {
    const sustained = everyNote.filter((note) => note.voice !== 'arp');

    expect(sustained.every((note) => note.index % CHORD_EIGHTHS === 0)).toBe(true);
    expect(sustained.every((note) => note.eighths === CHORD_EIGHTHS)).toBe(true);
    expect(sustained.filter((note) => note.voice === 'drone')).toHaveLength(4);
  });

  it('stays in F sharp and never plays a third, so it sits under both modes of the set', () => {
    const pitchClasses = new Set(everyNote.map((note) => (note.midi - ROOT_MIDI) % 12));

    expect([...pitchClasses].sort((a, b) => a - b)).toEqual([0, 5, 7, 8, 10]);
  });

  it('has no kick: its only short notes are a soft arpeggio of the chord, above middle C', () => {
    const arpeggio = everyNote.filter((note) => note.voice === 'arp');

    expect(arpeggio.length).toBeGreaterThan(CYCLE / 2);
    expect(arpeggio.length).toBeLessThan(CYCLE);
    for (const note of arpeggio) {
      const chord = ambienceChordAt(note.index).tones.map((midi) => midi % 12);
      expect(note.eighths).toBe(1);
      expect(note.midi).toBeGreaterThanOrEqual(60);
      expect(chord).toContain(note.midi % 12);
    }
  });
});

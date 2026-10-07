import { describe, expect, it } from 'vitest';
import {
  ROOT_MIDI,
  SCALE_SEMITONES,
  SUNRISE_SEMITONES,
  chordRootOfBar,
  degreeToHz,
  degreeToMidi,
  midiToHz,
} from './scale';

describe('midiToHz', () => {
  it('tunes A4 to 440 Hz and doubles per octave', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBeCloseTo(880, 9);
    expect(midiToHz(57)).toBeCloseTo(220, 9);
  });
});

describe('degreeToMidi', () => {
  it('starts the scale on the root, F sharp', () => {
    expect(degreeToMidi(0)).toBe(ROOT_MIDI);
    expect(ROOT_MIDI % 12).toBe(6);
  });

  it('walks the phrygian scale and wraps into the next octave', () => {
    const octave = SCALE_SEMITONES.map((_, degree) => degreeToMidi(degree) - ROOT_MIDI);

    expect(octave).toEqual([0, 1, 3, 5, 7, 8, 10]);
    expect(degreeToMidi(SCALE_SEMITONES.length)).toBe(ROOT_MIDI + 12);
    expect(degreeToMidi(2, 3)).toBe(ROOT_MIDI + 36 + 3);
  });

  it('wraps negative degrees below the root', () => {
    expect(degreeToMidi(-1)).toBe(ROOT_MIDI - 2);
    expect(degreeToMidi(-7)).toBe(ROOT_MIDI - 12);
  });

  it('rejects a fractional degree', () => {
    expect(() => degreeToMidi(0.5)).toThrow(RangeError);
  });

  it('keeps every degree in the key', () => {
    for (let degree = -14; degree < 28; degree += 1) {
      const pitchClass = (((degreeToMidi(degree) - ROOT_MIDI) % 12) + 12) % 12;
      expect(SCALE_SEMITONES).toContain(pitchClass);
    }
  });
});

describe('degreeToHz', () => {
  it('puts the bass root near 46 Hz', () => {
    expect(degreeToHz(0)).toBeCloseTo(46.25, 2);
  });
});

describe('chordRootOfBar', () => {
  it('cycles a four bar progression', () => {
    expect([0, 1, 2, 3, 4, 5].map((bar) => chordRootOfBar([0, 1, 0, -1], bar))).toEqual([
      0, 1, 0, -1, 0, 1,
    ]);
  });

  it('rejects a fractional bar', () => {
    expect(() => chordRootOfBar([0, 1, 0, -1], 1.5)).toThrow(RangeError);
  });
});

describe('SUNRISE_SEMITONES', () => {
  it('voices a major chord on the root', () => {
    const pitchClasses = new Set(SUNRISE_SEMITONES.map((semitones) => semitones % 12));

    expect([...pitchClasses].sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });
});

export const ROOT_MIDI = 30;
export const SCALE_SEMITONES: readonly number[] = [0, 1, 3, 5, 7, 8, 10];
export const BAR_CHORD_DEGREES: readonly number[] = [0, 1, 0, -1];
export const SUNRISE_SEMITONES: readonly number[] = [0, 7, 12, 16, 19, 24];

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function degreeToMidi(degree: number, octave = 0): number {
  const size = SCALE_SEMITONES.length;
  const wraps = Math.floor(degree / size);
  const semitones = SCALE_SEMITONES[degree - wraps * size];
  if (semitones === undefined) {
    throw new RangeError(`degree must be a whole number, got ${String(degree)}`);
  }
  return ROOT_MIDI + 12 * (octave + wraps) + semitones;
}

export function degreeToHz(degree: number, octave = 0): number {
  return midiToHz(degreeToMidi(degree, octave));
}

export function chordRootOfBar(bar: number): number {
  const size = BAR_CHORD_DEGREES.length;
  const root = BAR_CHORD_DEGREES[((bar % size) + size) % size];
  if (root === undefined) {
    throw new RangeError(`bar must be a whole number, got ${String(bar)}`);
  }
  return root;
}

import type { MusicTrack } from '../data/types';

export type MusicKey = Pick<MusicTrack, 'rootMidi' | 'scale'>;

// The menu's key, and the key of a track-less call.
export const ROOT_MIDI = 30;
export const SCALE_SEMITONES: readonly number[] = [0, 1, 3, 5, 7, 8, 10];
export const SUNRISE_SEMITONES: readonly number[] = [0, 7, 12, 16, 19, 24];

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function degreeToMidi(
  degree: number,
  octave = 0,
  scale: readonly number[] = SCALE_SEMITONES,
  root = ROOT_MIDI,
): number {
  const size = scale.length;
  const wraps = Math.floor(degree / size);
  const semitones = scale[degree - wraps * size];
  if (semitones === undefined) {
    throw new RangeError(`degree must be a whole number, got ${String(degree)}`);
  }
  return root + 12 * (octave + wraps) + semitones;
}

export function degreeToHz(
  degree: number,
  octave = 0,
  scale: readonly number[] = SCALE_SEMITONES,
  root = ROOT_MIDI,
): number {
  return midiToHz(degreeToMidi(degree, octave, scale, root));
}

export function keyHz(key: MusicKey, degree: number, octave = 0): number {
  return degreeToHz(degree, octave, key.scale, key.rootMidi);
}

export function chordRootOfBar(chords: readonly number[], bar: number): number {
  const size = chords.length;
  const root = chords[((bar % size) + size) % size];
  if (root === undefined) {
    throw new RangeError(`bar must be a whole number, got ${String(bar)}`);
  }
  return root;
}

import { SCALES } from '../data/scales';
import type { MusicTrack } from '../data/types';

export type MusicKey = Pick<MusicTrack, 'rootMidi' | 'scale'>;

// The menu's key, and the key of a track-less call.
export const ROOT_MIDI = 30;
export const SCALE_SEMITONES: readonly number[] = SCALES.phrygian;

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

// Each chord tone by the semitones it may sit at, in the order tried: a scale without a seventh, the
// major pentatonic, takes its sixth.
const CHORD_TONES: readonly (readonly number[])[] = [[0], [3, 4], [7], [10, 11, 9]];

// The scale as the effects count it, seven degrees to the octave (ADR 0026): its root, third, fifth
// and seventh on the even degrees, and on each odd one its next note above the chord tone below. A
// seven-note scale reads as itself; in a shorter one a chord stays a chord and an octave an octave.
export function sevenDegrees(scale: readonly number[]): readonly number[] {
  return CHORD_TONES.flatMap((intervals, rank) => {
    const at =
      intervals.map((semitones) => scale.indexOf(semitones)).find((index) => index >= 0) ?? -1;
    const tone = scale[at];
    if (tone === undefined) {
      throw new RangeError(
        `The scale ${scale.join(' ')} has no chord tone at ${intervals.join(' or ')}`,
      );
    }
    return rank === CHORD_TONES.length - 1 ? [tone] : [tone, scale[at + 1] ?? tone];
  });
}

export function effectKey<Key extends MusicKey>(key: Key): Key {
  return { ...key, scale: sevenDegrees(key.scale) };
}

export function chordRootOfBar(chords: readonly number[], bar: number): number {
  const size = chords.length;
  const root = chords[((bar % size) + size) % size];
  if (root === undefined) {
    throw new RangeError(`bar must be a whole number, got ${String(bar)}`);
  }
  return root;
}

// The degrees of its key's scale a sound reads as it plays, so a page can tell which sounds change
// with the scale.
export function degreesRead(play: (key: MusicKey) => void, key: MusicKey): ReadonlySet<number> {
  const read = new Set<number>();
  const scale = new Proxy([...key.scale], {
    get(target, property, receiver): unknown {
      if (typeof property === 'string' && /^\d+$/.test(property)) {
        read.add(Number(property));
      }
      return Reflect.get(target, property, receiver);
    },
  });
  play({ ...key, scale });
  return read;
}

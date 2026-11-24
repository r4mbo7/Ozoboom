// The notes an artist declares, on a tonal sample (ADR 0022, K7) or as the root of a track's key
// (ADR 0026), shared by the game and `pnpm sounds`.
// It imports nothing, so the command loads it in plain Node.

export interface Note {
  // Scientific pitch, with sharps: `Db4` is `C#4`.
  readonly name: string;
  readonly midi: number;
}

const PITCH_CLASSES: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const modulo = (value: number, by: number): number => ((value % by) + by) % by;

function semitonesFromC(letter: string, accidental: string): number | null {
  const pitchClass = PITCH_CLASSES[letter];
  if (pitchClass === undefined) {
    return null;
  }
  return pitchClass + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
}

export function parseNote(text: string): Note | null {
  const [, letter = '', accidental = '', octave = ''] = /^([A-G])([#b]?)(-?\d+)$/.exec(text) ?? [];
  const pitch = semitonesFromC(letter, accidental);
  if (pitch === null) {
    return null;
  }
  const midi = 12 * (Number(octave) + 1) + pitch;
  return { name: `${sharpName(midi)}${String(Math.floor(midi / 12) - 1)}`, midi };
}

// A note without its octave, `E` or `Bb`, as the root of a key (ADR 0026): 0 for C to 11 for B.
export function parsePitchClass(text: string): number | null {
  const [, letter = '', accidental = ''] = /^([A-G])([#b]?)$/.exec(text) ?? [];
  const pitch = semitonesFromC(letter, accidental);
  return pitch === null ? null : modulo(pitch, 12);
}

export function sharpName(midi: number): string {
  return SHARP_NAMES[modulo(midi, 12)] ?? '';
}

// How far a note is moved to reach a root, folded to the nearest octave: -6 to +5 semitones, a
// tritone going down.
export function semitonesToRoot(noteMidi: number, rootMidi: number): number {
  return modulo(rootMidi - noteMidi + 6, 12) - 6;
}

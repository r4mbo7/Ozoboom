// The notes an artist declares on a tonal sample (ADR 0022, K7), shared by the game and `pnpm sounds`.
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

export function parseNote(text: string): Note | null {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(text);
  const pitchClass = PITCH_CLASSES[match?.[1] ?? ''];
  if (match === null || pitchClass === undefined) {
    return null;
  }
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const midi = 12 * (Number(match[3]) + 1) + pitchClass + accidental;
  const name = `${SHARP_NAMES[modulo(midi, 12)] ?? ''}${String(Math.floor(midi / 12) - 1)}`;
  return { name, midi };
}

// How far a note is moved to reach a root, folded to the nearest octave: -6 to +5 semitones, a
// tritone going down.
export function semitonesToRoot(noteMidi: number, rootMidi: number): number {
  return modulo(rootMidi - noteMidi + 6, 12) - 6;
}

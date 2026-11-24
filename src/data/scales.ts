// The scales a track can play in, in semitones above its root, by the name `pnpm sounds key` takes
// (ADR 0026). A scale enters the list once every effect has been heard in it.
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  hijaz: [0, 1, 4, 5, 7, 8, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'hungarian-minor': [0, 2, 3, 6, 7, 8, 11],
  'major-pentatonic': [0, 2, 4, 7, 9],
  'minor-pentatonic': [0, 3, 5, 7, 10],
  'minor-blues': [0, 3, 5, 6, 7, 10],
} as const satisfies Readonly<Record<string, readonly number[]>>;

export type ScaleName = keyof typeof SCALES;

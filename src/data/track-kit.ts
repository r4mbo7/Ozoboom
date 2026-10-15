import type { MusicNotes } from './types';

export const HIJAZ = [0, 1, 4, 5, 7, 8, 10];
export const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
export const DORIAN = [0, 2, 3, 5, 7, 9, 10];

export function hits(steps: readonly number[], degree = 0): MusicNotes {
  return steps.map((step) => [step, degree, 1]);
}

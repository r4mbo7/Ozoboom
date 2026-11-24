import type { MusicNotes } from './types';

export function hits(steps: readonly number[], degree = 0): MusicNotes {
  return steps.map((step) => [step, degree, 1]);
}

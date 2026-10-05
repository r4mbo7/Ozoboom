import type { SimState } from '../sim/state';

export type Mood = 'set' | 'menu';

export type Cue = 'seatTaken' | 'seatFreed' | 'launch';

export interface AudioEngine {
  start(): Promise<void>;
  update(state: SimState): void;
  setMuted(muted: boolean): void;
  setMood(mood: Mood): void;
  cue(name: Cue): void;
  destroy(): void;
}

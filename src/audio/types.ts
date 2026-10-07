import type { MusicTrack } from '../data/types';
import type { SimState } from '../sim/state';

export type Mood = 'set' | 'menu';

export type Cue = 'seatTaken' | 'seatFreed' | 'launch';

export interface AudioEngine {
  start(): Promise<void>;
  update(state: SimState): void;
  setMuted(muted: boolean): void;
  // The player's level, from 0 to 1: the engine makes each step sound as large as the last.
  setVolume(volume: number): void;
  setMood(mood: Mood): void;
  // The track of what is scheduled from now on: called when a game begins.
  setTrack(track: MusicTrack): void;
  cue(name: Cue): void;
  destroy(): void;
}

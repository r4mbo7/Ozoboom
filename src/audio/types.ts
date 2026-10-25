import type { MusicTrack } from '../data/types';
import type { SimState } from '../sim/state';

export type Mood = 'set' | 'menu';

export type Cue =
  | 'seatTaken'
  | 'seatFreed'
  | 'launch'
  // The upgrade menu; `cardDealt` takes its turn as variant.
  | 'cardDealt'
  | 'cardsReady'
  | 'cardRare'
  | 'cardLegendary'
  | 'upgradeChosen'
  | 'mateChose'
  | 'cardFlight'
  | 'cardLanded';

export interface AudioEngine {
  start(): Promise<void>;
  update(state: SimState): void;
  setMuted(muted: boolean): void;
  // 0 to 1: the engine makes each step sound as large as the last.
  setVolume(volume: number): void;
  // On until told otherwise.
  setHitSound(enabled: boolean): void;
  setMood(mood: Mood): void;
  // In eighths since the first note of the menu ambience; null while it is silent or the sound is off.
  menuPosition(): number | null;
  // Called when a game begins.
  setTrack(track: MusicTrack): void;
  // The variant picks among the notes of a cue that has several.
  cue(name: Cue, variant?: number): void;
  destroy(): void;
}

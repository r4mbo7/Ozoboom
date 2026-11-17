import type { MusicTrack } from '../data/types';
import type { MenuHeard } from '../shared/menu-score';
import type { SimState } from '../sim/state';

// The menus play the menu track once it is decoded; the pause keeps the ambience.
export type Mood = 'set' | 'menu' | 'pause';

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
  // null while the menus are silent or the sound is off.
  menuPosition(): MenuHeard | null;
  // Called when a game begins.
  setTrack(track: MusicTrack): void;
  // The variant picks among the notes of a cue that has several.
  cue(name: Cue, variant?: number): void;
  destroy(): void;
}

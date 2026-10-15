import type { MusicTrack } from '../data/types';
import type { SimState } from '../sim/state';

export type Mood = 'set' | 'menu';

export type Cue =
  | 'seatTaken'
  | 'seatFreed'
  | 'launch'
  // The upgrade menu: a card dealt (its turn as variant), the highlight, a rare card, a choice, a flight.
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
  // The player's level, from 0 to 1: the engine makes each step sound as large as the last.
  setVolume(volume: number): void;
  // Whether a hit on a bad vibe sounds; it does until told otherwise.
  setHitSound(enabled: boolean): void;
  setMood(mood: Mood): void;
  // How far the menu ambience is as heard now, in eighths since its first note; null while it is
  // silent or the sound is off.
  menuPosition(): number | null;
  // The track of what is scheduled from now on: called when a game begins.
  setTrack(track: MusicTrack): void;
  // The variant picks among the notes of a cue that has several.
  cue(name: Cue, variant?: number): void;
  destroy(): void;
}

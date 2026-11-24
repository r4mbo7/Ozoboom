import type { MusicTrack } from '../data/types';
import type { MenuHeard } from '../shared/menu-score';
import type { SimState } from '../sim/state';
import type { SpecialTake } from './sfx';

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
  // While the music holds the game, its cards answered, for the beat line of the loop it resumes
  // on: the page time of that beat (`performance.now`), and the game takes no step meanwhile. Keeps
  // the music playing with `state`, which it does not play the events of. Null once there, and
  // without a running, heard context.
  waitsForBeat(state: SimState): number | null;
  // Each frame of the entry a run opens on, until `landsAt` (`performance.now`): the first call makes
  // the menus leave within a sixteenth, plays the entry's sounds and lands the tick of `state` on
  // `landsAt`, the music at full level. Keeps the music playing with `state`, which it does not play
  // the events of. Nothing without a running context: the entry then plays in silence.
  enter(state: SimState, landsAt: number): void;
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
  // Settles once the artists' files have decoded or failed, the effects' and those of the track set
  // last: at once without any.
  loaded(): Promise<void>;
  // The variant picks among the notes of a cue that has several.
  cue(name: Cue, variant?: number): void;
  // A class's special, as the game sounds it when cast: the Programme's « Listen ».
  playSpecial(classId: string): void;
  // Plays sim events as a game plays them, each `after` seconds on, outside any game: a prop's sound in
  // the Programme.
  hear(take: SpecialTake): void;
  destroy(): void;
}

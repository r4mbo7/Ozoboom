import type { GameContent } from '../data/types';
import type { SimState } from '../sim/state';

export interface Ending {
  title: string;
  text: string;
}

// What a mode of the full game says at the end of its games: its own words, and what it lists.
export interface EndPart {
  ending: Ending;
  details: HTMLElement;
}

export type EndPartOf = (state: SimState, content: GameContent | null) => EndPart | null;

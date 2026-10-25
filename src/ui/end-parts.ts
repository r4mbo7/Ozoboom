import type { GameContent } from '../data/types';
import type { SimState } from '../sim/state';

export interface Ending {
  title: string;
  text: string;
}

export interface EndPart {
  ending: Ending;
  details: HTMLElement;
}

export type EndPartOf = (state: SimState, content: GameContent | null) => EndPart | null;

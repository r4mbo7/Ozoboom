import type { GameContent } from '../data/types';
import type { BoardLine } from './types';
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

// The end screen's leaderboard line, full game only: the pseudo asked, or the run's rank.
export interface BoardLineView {
  readonly element: HTMLElement;
  // What the end screen's menu walks through, in order.
  items(): readonly HTMLElement[];
  activate(item: HTMLElement): void;
  set(line: BoardLine | null): void;
}

export type CreateBoardLine = (name: (pseudo: string) => void) => BoardLineView;

import type { GameContent } from '../data/types';
import type { SimState } from '../sim/state';
import type { UiFrame } from './types';

// Where a part of the HUD of the full game settles: in the band of the line-up, or over the arena.
export interface HudParts {
  readonly ribbon: HTMLElement;
  readonly overlay: HTMLElement;
}

// What the place key does here instead of moving a trap, for the HUD to say it.
export interface PlaceKeyUse {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
}

export interface HudPart {
  update(state: SimState, content: GameContent, frame: UiFrame): void;
}

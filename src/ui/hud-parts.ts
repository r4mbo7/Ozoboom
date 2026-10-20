import type { GameContent } from '../data/types';
import type { SimState } from '../sim/state';

// Where a part of the HUD of the full game settles: in the band of the line-up, or over the arena.
export interface HudParts {
  readonly ribbon: HTMLElement;
  readonly overlay: HTMLElement;
}

export interface HudPart {
  update(state: SimState, content: GameContent): void;
}

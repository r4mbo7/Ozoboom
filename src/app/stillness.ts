import type { SimState } from '../sim/state';

// Behind a level offer the game is drawn once, until it moves or resizes; behind relics the boss's farewell is drawn on.
export interface Stillness {
  draws(
    state: Pick<SimState, 'status' | 'pendingUpgrades' | 'tick'>,
    width: number,
    height: number,
  ): boolean;
}

export function createStillness(): Stillness {
  let drawn: string | null = null;
  return {
    draws(state, width, height) {
      const still =
        state.status === 'choosingUpgrade' &&
        state.pendingUpgrades.every((offer) => offer.kind !== 'relic');
      if (!still) {
        drawn = null;
        return true;
      }
      const key = `${String(state.tick)} ${String(width)}x${String(height)}`;
      if (key === drawn) {
        return false;
      }
      drawn = key;
      return true;
    },
  };
}

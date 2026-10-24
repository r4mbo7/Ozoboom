import type { SimState } from '../sim/state';

// The game behind a level offer stands still: drawn once, it is not drawn again until it moves or
// the window changes size. Behind relics the boss says farewell in real time: it is drawn on.
export interface Stillness {
  draws(state: SimState, width: number, height: number): boolean;
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

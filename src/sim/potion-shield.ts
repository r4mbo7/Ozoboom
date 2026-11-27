import type { PlayerState } from './state';

export const POTION_BOOST = 'potion';

// An Intolérant's suppression leaves the potion on: shield, bonuses and all.
export function potionShielded(player: Pick<PlayerState, 'boosts'>): boolean {
  return player.boosts?.some(isPotionBoost) === true;
}

export function isPotionBoost(boost: { readonly id: string }): boolean {
  return boost.id === POTION_BOOST;
}

// What a slow leaves of a player's walk: nothing under the potion, where a slow from before waits.
export function walkSlow(player: Pick<PlayerState, 'boosts' | 'slowFactor'>): number {
  return potionShielded(player) ? 1 : (player.slowFactor ?? 1);
}

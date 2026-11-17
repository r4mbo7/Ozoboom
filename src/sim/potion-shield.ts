import type { PlayerState } from './state';

export const POTION_BOOST = 'potion';

// An Intolérant's suppression puts out the shield with his other bonuses.
export function potionShielded(player: Pick<PlayerState, 'boosts' | 'suppressedTicks'>): boolean {
  return (
    (player.suppressedTicks ?? 0) === 0 &&
    player.boosts?.some((boost) => boost.id === POTION_BOOST) === true
  );
}

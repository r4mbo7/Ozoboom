import type { StepContext } from './types';

// A player whose peer left the game (the action `leave` the host sends for them) is gone for good: their
// offers drop, and no other comes, so that nobody waits for their choice.
export function departures({ state, commands }: StepContext): void {
  for (const player of state.players) {
    if (
      player.gone === true ||
      commands.get(player.id)?.actions.some((action) => action.type === 'leave') !== true
    ) {
      continue;
    }
    player.gone = true;
    player.pendingLevelUps = 0;
    state.pendingUpgrades = state.pendingUpgrades.filter((offer) => offer.playerId !== player.id);
  }
}

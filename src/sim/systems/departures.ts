import type { StepContext } from './types';

// A player whose peer left is gone for good, offers dropped, so that nobody waits for their choice.
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

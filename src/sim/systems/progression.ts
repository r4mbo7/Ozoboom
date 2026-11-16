import { drawOffer } from '../draw';
import { finishWins } from '../mode';
import type { PlayerState } from '../state';
import { vibesToReach } from '../team';
import { isLastBossDown } from './set-progress';
import type { StepContext } from './types';

export function progression(ctx: StepContext): void {
  const { state, set } = ctx;
  for (const player of state.players) {
    while (player.vibes >= player.vibesToNextLevel) {
      player.vibes -= player.vibesToNextLevel;
      player.level += 1;
      player.vibesToNextLevel = vibesToReach(set, player.level, state.players.length);
      if (set.powerPerLevel !== undefined) {
        player.levelPower = 1 + set.powerPerLevel * (player.level - 1);
      }
      player.pendingLevelUps = (player.pendingLevelUps ?? 0) + 1;
      state.events.push({ type: 'levelUp', playerId: player.id, level: player.level });
    }
    presentNextOffer(ctx, player);
  }
}

// Drawn only once the current offer is answered: queued offers would ignore the upgrades chosen.
export function presentNextOffer(ctx: StepContext, player: PlayerState): void {
  const { state, content, set } = ctx;
  if (
    player.gone === true ||
    (isLastBossDown(state, set) && finishWins(ctx)) ||
    state.pendingUpgrades.some((offer) => offer.playerId === player.id)
  ) {
    return;
  }
  while ((player.pendingLevelUps ?? 0) > 0) {
    player.pendingLevelUps = (player.pendingLevelUps ?? 0) - 1;
    const offer = drawOffer(state.rng, state, content, set, player);
    if (offer.options.length > 0) {
      state.pendingUpgrades.push({ playerId: player.id, ...offer });
      return;
    }
  }
}

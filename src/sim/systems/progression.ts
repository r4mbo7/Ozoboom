import type { SetDefinition } from '../../data/types';
import { drawOffer } from '../draw';
import { finishWins } from '../mode';
import type { PlayerState } from '../state';
import { isLastBossDown } from './set-progress';
import type { StepContext } from './types';

export function progression(ctx: StepContext): void {
  const { state, set } = ctx;
  for (const player of state.players) {
    while (player.vibes >= player.vibesToNextLevel) {
      player.vibes -= player.vibesToNextLevel;
      player.level += 1;
      player.vibesToNextLevel = vibesToReach(set, player.level);
      player.pendingLevelUps = (player.pendingLevelUps ?? 0) + 1;
      state.events.push({ type: 'levelUp', playerId: player.id, level: player.level });
    }
    presentNextOffer(ctx, player);
  }
}

// Draws the player's next offer only once the current one is answered, with the eligibility of
// that moment: queued offers would ignore the upgrades chosen in between.
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

function vibesToReach(set: SetDefinition, level: number): number {
  const { baseVibes, vibesPerLevel } = set.levelCurve;
  const vibes = baseVibes + vibesPerLevel * (level - 1);
  if (!(vibes > 0)) {
    throw new RangeError(`set "${set.id}" asks ${String(vibes)} vibes for level ${String(level)}`);
  }
  return vibes;
}

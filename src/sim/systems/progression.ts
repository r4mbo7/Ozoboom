import type { SetDefinition } from '../../data/types';
import type { ResolvedContent } from '../content';
import { drawOffer } from '../draw';
import type { PlayerState, SimState } from '../state';
import type { StepContext } from './types';

export function progression({ state, content, set }: StepContext): void {
  for (const player of state.players) {
    while (player.vibes >= player.vibesToNextLevel) {
      player.vibes -= player.vibesToNextLevel;
      player.level += 1;
      player.vibesToNextLevel = vibesToReach(set, player.level);
      player.pendingLevelUps = (player.pendingLevelUps ?? 0) + 1;
      state.events.push({ type: 'levelUp', playerId: player.id, level: player.level });
    }
    presentNextOffer(state, content, set, player);
  }
}

// Draws the player's next offer only once the current one is answered, with the eligibility of
// that moment: queued offers would ignore the upgrades chosen in between.
export function presentNextOffer(
  state: SimState,
  content: ResolvedContent,
  set: SetDefinition,
  player: PlayerState,
): void {
  if (state.pendingUpgrades.some((offer) => offer.playerId === player.id)) {
    return;
  }
  while ((player.pendingLevelUps ?? 0) > 0) {
    player.pendingLevelUps = (player.pendingLevelUps ?? 0) - 1;
    const options = drawOffer(state.rng, state, content, set, player);
    if (options.length > 0) {
      state.pendingUpgrades.push({ playerId: player.id, options });
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

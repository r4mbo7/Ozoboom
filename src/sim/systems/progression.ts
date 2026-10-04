import type { SetDefinition, UpgradeDefinition } from '../../data/types';
import { nextInt } from '../../shared/prng';
import type { ResolvedContent } from '../content';
import type { PlayerState, RngState, SimState } from '../state';
import type { StepContext } from './types';

const OFFER_SIZE = 3;

export function progression({ state, content, set }: StepContext): void {
  for (const player of state.players) {
    while (player.vibes >= player.vibesToNextLevel) {
      player.vibes -= player.vibesToNextLevel;
      player.level += 1;
      player.vibesToNextLevel = vibesToReach(set, player.level);
      player.pendingLevelUps = (player.pendingLevelUps ?? 0) + 1;
      state.events.push({ type: 'levelUp', playerId: player.id, level: player.level });
    }
    presentNextOffer(state, content, player);
  }
}

// Draws the player's next offer only once the current one is answered, with the eligibility of
// that moment: queued offers would ignore the upgrades chosen in between.
export function presentNextOffer(
  state: SimState,
  content: ResolvedContent,
  player: PlayerState,
): void {
  if (state.pendingUpgrades.some((offer) => offer.playerId === player.id)) {
    return;
  }
  while ((player.pendingLevelUps ?? 0) > 0) {
    player.pendingLevelUps = (player.pendingLevelUps ?? 0) - 1;
    const options = drawOffer(state.rng, eligibleUpgrades(content, player));
    if (options.length > 0) {
      state.pendingUpgrades.push({ playerId: player.id, options });
      return;
    }
  }
}

export function isEligible(upgrade: UpgradeDefinition, player: PlayerState): boolean {
  if (upgrade.family === 'class' && upgrade.classId !== player.classId) {
    return false;
  }
  const stacks = player.upgrades.filter((id) => id === upgrade.id).length;
  return stacks < upgrade.maxStacks;
}

function vibesToReach(set: SetDefinition, level: number): number {
  const { baseVibes, vibesPerLevel } = set.levelCurve;
  const vibes = baseVibes + vibesPerLevel * (level - 1);
  if (!(vibes > 0)) {
    throw new RangeError(`set "${set.id}" asks ${String(vibes)} vibes for level ${String(level)}`);
  }
  return vibes;
}

function eligibleUpgrades(content: ResolvedContent, player: PlayerState): string[] {
  const eligible: string[] = [];
  for (const upgrade of content.upgrades.values()) {
    if (isEligible(upgrade, player)) {
      eligible.push(upgrade.id);
    }
  }
  return eligible;
}

function drawOffer(rng: RngState, pool: string[]): string[] {
  const offer: string[] = [];
  while (offer.length < OFFER_SIZE && pool.length > 0) {
    offer.push(...pool.splice(nextInt(rng, pool.length), 1));
  }
  return offer;
}

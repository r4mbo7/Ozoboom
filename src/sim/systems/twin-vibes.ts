import type { SetDefinition } from '../../data/types';
import { nextInt, seedRng } from '../../shared/prng';
import { isBarTick, type Tempo } from '../../shared/tempo';
import { touches } from '../effects';
import type { SimState } from '../state';
import type { StepContext } from './types';

interface DrawnPhrase {
  tier: number;
  phrase: number;
}

// Drawn from the seed and the stage's start, so each stage of a festival has its own, and the game's draws stay as they were.
export function twinVibesPhrase(
  seed: number,
  stageStartTick: number,
  set: SetDefinition,
): DrawnPhrase | null {
  const choices = set.tiers.reduce((sum, tier) => sum + Math.max(0, tier.buildupPhrases - 1), 0);
  if (choices === 0) {
    return null;
  }
  let left = nextInt(seedRng((seed + stageStartTick) >>> 0), choices);
  for (const [tier, { buildupPhrases }] of set.tiers.entries()) {
    const later = Math.max(0, buildupPhrases - 1);
    if (left < later) {
      return { tier, phrase: left + 1 };
    }
    left -= later;
  }
  return null;
}

// A bomb due goes first, and the two never ride the same bad vibe.
export function twinVibesCarriers({ state, set, tempo }: StepContext): void {
  if (set.twinVibes === undefined) {
    return;
  }
  if (
    state.twinVibes === undefined &&
    isBarTick(state.tick, tempo) &&
    isDrawnPhrase(state, set, tempo)
  ) {
    state.twinVibes = { stage: 'due' };
  }
  if (state.twinVibes?.stage !== 'due' || state.bombDue === true) {
    return;
  }
  for (const event of state.events) {
    const enemy =
      event.type === 'enemySpawned' ? state.enemies.find(({ id }) => id === event.id) : undefined;
    if (
      enemy !== undefined &&
      !enemy.isBoss &&
      enemy.carriesTrap === undefined &&
      enemy.carriesBomb !== true
    ) {
      enemy.carriesTwinVibes = true;
      state.twinVibes = { stage: 'carried' };
      return;
    }
  }
}

function isDrawnPhrase(state: SimState, set: SetDefinition, tempo: Tempo): boolean {
  const { set: progress } = state;
  if (progress.segment !== 'buildup') {
    return false;
  }
  const drawn = twinVibesPhrase(state.seed, progress.startTick ?? 0, set);
  return (
    drawn !== null &&
    drawn.tier === progress.tier &&
    state.tick - progress.segmentStartTick >= drawn.phrase * tempo.ticksPerPhrase
  );
}

export function dropTwinVibes({ state, set, tempo }: StepContext, x: number, y: number): void {
  const rules = set.twinVibes;
  if (rules === undefined) {
    return;
  }
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  state.twinVibes = { stage: 'lying', id, x, y, ticksLeft: rules.lifetimeBars * tempo.ticksPerBar };
  state.events.push({ type: 'twinVibesDropped', id, x, y });
}

export function twinVibes({ state, set, tempo }: StepContext): void {
  const rules = set.twinVibes;
  const twins = state.twinVibes;
  if (rules === undefined || twins === undefined) {
    return;
  }
  if (twins.stage === 'lying') {
    const taker = state.players.find(
      (player) => !player.downed && touches(player, twins, rules.radius),
    );
    if (taker !== undefined) {
      const { id, x, y } = twins;
      state.twinVibes = { stage: 'doubling', ticksLeft: rules.bars * tempo.ticksPerBar };
      state.events.push({ type: 'twinVibesTaken', id, playerId: taker.id, x, y });
      return;
    }
  }
  if (twins.stage !== 'lying' && twins.stage !== 'doubling') {
    return;
  }
  twins.ticksLeft -= 1;
  if (twins.ticksLeft > 0) {
    return;
  }
  if (twins.stage === 'doubling') {
    state.events.push({ type: 'twinVibesEnded' });
  }
  state.twinVibes = { stage: 'over' };
}

export function vibesDoubled(state: SimState): boolean {
  return state.twinVibes?.stage === 'doubling';
}

import type { SetDefinition } from '../../data/types';
import { seedRng } from '../../shared/prng';
import { isBarTick } from '../../shared/tempo';
import { touches } from '../effects';
import type { SimState } from '../state';
import { drawBuildupPhrase, freeCarrier, inDrawnPhrase, type DrawnPhrase } from './stage-bonus';
import type { StepContext } from './types';

// Drawn from the seed and the stage's start, so each stage of a festival has its own, and the game's draws stay as they were.
export function twinVibesPhrase(
  seed: number,
  stageStartTick: number,
  set: SetDefinition,
): DrawnPhrase | null {
  return drawBuildupPhrase(seedRng((seed + stageStartTick) >>> 0), set);
}

// A bomb due goes first, and the two never ride the same bad vibe.
export function twinVibesCarriers({ state, set, tempo }: StepContext): void {
  if (set.twinVibes === undefined) {
    return;
  }
  if (
    state.twinVibes === undefined &&
    isBarTick(state.tick, tempo) &&
    inDrawnPhrase(state, set, tempo, twinVibesPhrase)
  ) {
    state.twinVibes = { stage: 'due' };
  }
  if (state.twinVibes?.stage !== 'due' || state.bombDue === true) {
    return;
  }
  const carrier = freeCarrier(state);
  if (carrier !== undefined) {
    carrier.carriesTwinVibes = true;
    state.twinVibes = { stage: 'carried' };
  }
}

export function dropTwinVibes({ state, set }: StepContext, x: number, y: number): void {
  const rules = set.twinVibes;
  if (rules === undefined) {
    return;
  }
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  state.twinVibes = { stage: 'lying', id, x, y };
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
      (player) => !player.downed && player.gone !== true && touches(player, twins, rules.radius),
    );
    if (taker !== undefined) {
      const { id, x, y } = twins;
      state.twinVibes = { stage: 'doubling', ticksLeft: rules.bars * tempo.ticksPerBar };
      state.events.push({ type: 'twinVibesTaken', id, playerId: taker.id, x, y });
    }
    return;
  }
  if (twins.stage !== 'doubling') {
    return;
  }
  twins.ticksLeft -= 1;
  if (twins.ticksLeft > 0) {
    return;
  }
  state.events.push({ type: 'twinVibesEnded' });
  state.twinVibes = { stage: 'over' };
}

export function vibesDoubled(state: SimState): boolean {
  return state.twinVibes?.stage === 'doubling';
}

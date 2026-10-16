import type { SetDefinition, TierDefinition } from '../../data/types';
import { BARS_PER_PHRASE, TICK_RATE_HZ, isBarTick, type Tempo } from '../../shared/tempo';
import type { ResolvedContent } from '../content';
import { drawBoss } from '../draw';
import type { SetProgress, SetSegment, SimState } from '../state';
import type { StepContext } from './types';

const MIN_DROP_BARS = 1;
const TICKS_PER_MINUTE = 60 * TICK_RATE_HZ;

export function setProgress({ state, content, set, tempo }: StepContext): void {
  if (!isBarTick(state.tick, tempo)) {
    return;
  }
  let tier = currentTier(state.set, set);
  while (tier !== undefined && isSegmentOver(state, tier, tempo)) {
    advance(state, content, set);
    tier = currentTier(state.set, set);
  }
}

export function isSetFinished(progress: SetProgress, set: SetDefinition): boolean {
  return progress.tier >= set.tiers.length;
}

// The tier whose drop ends the game: an endless game has none.
export function isLastTier(progress: SetProgress, set: SetDefinition): boolean {
  return progress.endlessFromTick === undefined && progress.tier >= set.tiers.length - 1;
}

// Whole minutes into the endless part: 0 until the last boss first falls, and in a game that ends.
export function endlessMinutes({ tick, set }: SimState): number {
  return Math.floor((tick - (set.endlessFromTick ?? tick)) / TICKS_PER_MINUTE);
}

export function isLastBossDown(state: SimState, set: SetDefinition): boolean {
  return (
    isLastTier(state.set, set) &&
    state.set.segment === 'drop' &&
    !state.enemies.some((enemy) => enemy.isBoss)
  );
}

function currentTier(progress: SetProgress, set: SetDefinition): TierDefinition | undefined {
  return set.tiers[progress.tier];
}

function isSegmentOver(state: SimState, tier: TierDefinition, tempo: Tempo): boolean {
  const bars = (state.tick - state.set.segmentStartTick) / tempo.ticksPerBar;
  switch (state.set.segment) {
    case 'buildup':
      return bars >= tier.buildupPhrases * BARS_PER_PHRASE;
    case 'break':
      return bars >= tier.breakBars;
    case 'drop':
      return bars >= MIN_DROP_BARS && !state.enemies.some((enemy) => enemy.isBoss);
  }
}

function advance(state: SimState, content: ResolvedContent, set: SetDefinition): void {
  const progress = state.set;
  switch (progress.segment) {
    case 'buildup':
      state.bosses ??= [];
      state.bosses.push(drawBoss(state.seed, content, state.bosses));
      enterSegment(state, 'break');
      return;
    case 'break':
      enterSegment(state, 'drop');
      return;
    case 'drop':
      if (progress.endlessFromTick !== undefined && progress.tier === set.tiers.length - 1) {
        progress.endlessFromTick ??= state.tick;
      } else {
        progress.tier += 1;
      }
      if (!isSetFinished(progress, set)) {
        enterSegment(state, 'buildup');
      }
      return;
  }
}

function enterSegment(state: SimState, segment: SetSegment): void {
  state.set.segment = segment;
  state.set.segmentStartTick = state.tick;
  state.events.push({ type: 'segment', segment, tier: state.set.tier });
}

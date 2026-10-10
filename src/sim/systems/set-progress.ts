import type { SetDefinition, TierDefinition } from '../../data/types';
import { BARS_PER_PHRASE, isBarTick, type Tempo } from '../../shared/tempo';
import type { SetProgress, SetSegment, SimState } from '../state';
import type { StepContext } from './types';

const MIN_DROP_BARS = 1;

export function setProgress({ state, set, tempo }: StepContext): void {
  if (!isBarTick(state.tick, tempo)) {
    return;
  }
  let tier = currentTier(state.set, set);
  while (tier !== undefined && isSegmentOver(state, tier, tempo)) {
    advance(state, set);
    tier = currentTier(state.set, set);
  }
}

export function isSetFinished(progress: SetProgress, set: SetDefinition): boolean {
  return progress.tier >= set.tiers.length;
}

export function isLastTier(progress: SetProgress, set: SetDefinition): boolean {
  return progress.tier >= set.tiers.length - 1;
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

function advance(state: SimState, set: SetDefinition): void {
  const progress = state.set;
  switch (progress.segment) {
    case 'buildup':
      enterSegment(state, 'break');
      return;
    case 'break':
      enterSegment(state, 'drop');
      return;
    case 'drop':
      progress.tier += 1;
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

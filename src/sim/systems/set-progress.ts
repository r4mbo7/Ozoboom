import type { SetDefinition, TierDefinition } from '../../data/types';
import {
  BARS_PER_PHRASE,
  TICK_RATE_HZ,
  barOfTick,
  isBarTick,
  type Tempo,
} from '../../shared/tempo';
import type { ResolvedContent } from '../content';
import { segmentMusicTicks } from '../lineup';
import { drawBoss } from '../draw';
import type { SetProgress, SetSegment, SimState } from '../state';
import type { StepContext } from './types';

export const MIN_DROP_BARS = 1;
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

export function isLastTier(progress: SetProgress, set: SetDefinition): boolean {
  return progress.endlessFromTick === undefined && progress.tier >= set.tiers.length - 1;
}

export function endlessMinutes({ tick, set }: SimState): number {
  return Math.floor((tick - (set.endlessFromTick ?? tick)) / TICKS_PER_MINUTE);
}

export function isLastBossDown(state: SimState, set: SetDefinition): boolean {
  return isLastTier(state.set, set) && state.set.segment === 'drop' && !bossLeft(state);
}

function currentTier(progress: SetProgress, set: SetDefinition): TierDefinition | undefined {
  return set.tiers[progress.tier];
}

function isSegmentOver(state: SimState, tier: TierDefinition, tempo: Tempo): boolean {
  const bars = segmentMusicTicks(state.set, state.tick) / tempo.ticksPerBar;
  switch (state.set.segment) {
    case 'buildup':
      return bars >= tier.buildupPhrases * BARS_PER_PHRASE;
    case 'break':
      return bars >= tier.breakBars;
    case 'drop': {
      const end = dropEndTick(state.set, tempo);
      return bars >= MIN_DROP_BARS && !bossLeft(state) && (end === null || state.tick >= end);
    }
  }
}

// The bar line a drop ends on once its last boss fell: the first a beat after the fall at least, so
// that the music filters out over it, and never before the beats a card choice played again on the
// line it was to end on. Null before the fall, and where no buildup follows.
export function dropEndTick(progress: SetProgress, tempo: Tempo): number | null {
  if (progress.bossesDownTick === undefined) {
    return null;
  }
  const earliest = Math.max(
    progress.bossesDownTick + tempo.ticksPerBeat,
    progress.segmentStartTick +
      (progress.segmentReplayTicks ?? 0) +
      MIN_DROP_BARS * tempo.ticksPerBar,
    progress.replayEndTick ?? 0,
  );
  return tempo.originTick + (barOfTick(earliest - 1, tempo) + 1) * tempo.ticksPerBar;
}

// Without bad vibes, the drop's boss never falls: the drop plays on.
export function bossLeft(state: SimState): boolean {
  return (
    state.noEnemies === true ||
    state.bossesDue !== undefined ||
    state.enemies.some((enemy) => enemy.isBoss)
  );
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
  delete state.set.segmentReplayTicks;
  delete state.set.replayEndTick;
  delete state.set.bossesDownTick;
  state.events.push({ type: 'segment', segment, tier: state.set.tier });
}

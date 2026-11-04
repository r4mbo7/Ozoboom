import { TICK_RATE_HZ } from '../shared/tempo';
import type { SimState } from './state';
import { volumeMul } from './volume';

const PER_PHRASE = 1000;
const PER_SECOND = 10;
const PER_KILL = 5;
const PER_CORE_PERCENT = 2;
const PER_STAGE_HELD = 5000;
const PER_CALLED_BOSS = 500;

// The score with what each festival stage earns past its challenges.
export function scoreOf(state: SimState): number {
  let bonus = 0;
  for (const scene of state.festival?.scenes ?? []) {
    const challenges = scene.challenges;
    if (challenges !== undefined) {
      const earned = challenges.earned ?? stageEarned(state, challenges.scoreFrom);
      bonus += Math.floor(earned * (challenges.scoreMul - 1));
    }
  }
  return baseScore(state) + bonus;
}

export function baseScore(state: SimState): number {
  const corePercent = Math.floor((Math.max(0, state.core.hp) * 100) / state.core.maxHp);
  return Math.floor((stageGains(state) + corePercent * PER_CORE_PERCENT) * volumeMul(state));
}

// What a stage earned since `from`, a `stageGains` taken at its start, at the stage's Volume.
export function stageEarned(state: SimState, from: number): number {
  return Math.floor((stageGains(state) - from) * volumeMul(state));
}

// The points of the game so far that only grow, before the Volume: what a stage adds to them is its own.
export function stageGains(state: SimState): number {
  const { stats } = state;
  const stagesHeld = (state.festival?.scenes ?? []).filter(
    (scene) => scene.toTick !== undefined,
  ).length;
  const seconds = Math.floor(state.tick / TICK_RATE_HZ);
  return (
    stats.phrasesHeld * PER_PHRASE +
    seconds * PER_SECOND +
    stats.kills * PER_KILL +
    stagesHeld * PER_STAGE_HELD +
    (stats.calledDown ?? 0) * PER_CALLED_BOSS
  );
}

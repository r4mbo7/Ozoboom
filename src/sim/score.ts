import { TICK_RATE_HZ } from '../shared/tempo';
import type { SimState } from './state';
import { volumeMul } from './volume';

export type ScoreSource = 'phrases' | 'seconds' | 'kills' | 'stages' | 'calledBosses' | 'core';

export interface ScoreTerm {
  source: ScoreSource;
  count: number;
  // Points for each one counted.
  price: number;
  points: number;
}

export interface ScoreBreakdown {
  // The sources the game can have, in the order the end screen counts them.
  terms: ScoreTerm[];
  subtotal: number;
  // `points`: what the Volume adds to the subtotal.
  volume: { level: number; mul: number; points: number };
  // `rate`: the share of its stage's points each challenge adds.
  challenges: { count: number; rate: number; bonus: number };
  total: number;
}

const PRICES: Readonly<Record<ScoreSource, number>> = {
  phrases: 1000,
  seconds: 10,
  kills: 5,
  stages: 5000,
  calledBosses: 500,
  core: 2,
};

export function scoreOf(state: SimState): number {
  return scoreBreakdown(state).total;
}

// Every term of the score: the end screen shows them, the record keeps their total.
export function scoreBreakdown(state: SimState): ScoreBreakdown {
  const terms = [...gainTerms(state), term('core', corePercent(state))];
  const subtotal = sumOf(terms);
  const mul = volumeMul(state);
  const volume = Math.floor(subtotal * mul) - subtotal;
  const challenges = challengesOf(state);
  return {
    terms,
    subtotal,
    volume: { level: state.volume ?? 0, mul, points: volume },
    challenges,
    total: subtotal + volume + challenges.bonus,
  };
}

// What a stage earned since `from`, a `stageGains` taken at its start, at the stage's Volume.
export function stageEarned(state: SimState, from: number): number {
  return Math.floor((stageGains(state) - from) * volumeMul(state));
}

// The points of the game so far that only grow, before the Volume: what a stage adds to them is its own.
export function stageGains(state: SimState): number {
  return sumOf(gainTerms(state));
}

function gainTerms(state: SimState): ScoreTerm[] {
  const { stats, festival } = state;
  const scenes = festival?.scenes;
  const calledDown = stats.calledDown ?? 0;
  return [
    term('phrases', stats.phrasesHeld),
    term('seconds', Math.floor(state.tick / TICK_RATE_HZ)),
    term('kills', stats.kills),
    ...(scenes === undefined
      ? []
      : [term('stages', scenes.filter((scene) => scene.toTick !== undefined).length)]),
    ...(scenes === undefined && calledDown === 0 ? [] : [term('calledBosses', calledDown)]),
  ];
}

function challengesOf(state: SimState): ScoreBreakdown['challenges'] {
  let count = 0;
  let share = 0;
  let bonus = 0;
  for (const scene of state.festival?.scenes ?? []) {
    const challenges = scene.challenges;
    if (challenges !== undefined) {
      const earned = challenges.earned ?? stageEarned(state, challenges.scoreFrom);
      bonus += Math.floor(earned * (challenges.scoreMul - 1));
      count += challenges.ids.length;
      share += challenges.scoreMul - 1;
    }
  }
  return { count, rate: count === 0 ? 0 : share / count, bonus };
}

function corePercent(state: SimState): number {
  return Math.floor((Math.max(0, state.core.hp) * 100) / state.core.maxHp);
}

function term(source: ScoreSource, count: number): ScoreTerm {
  const price = PRICES[source];
  return { source, count, price, points: count * price };
}

function sumOf(terms: readonly ScoreTerm[]): number {
  return terms.reduce((sum, each) => sum + each.points, 0);
}

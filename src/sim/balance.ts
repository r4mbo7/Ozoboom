import { CONTENT } from '../data/content';
import type { GameContent } from '../data/types';
import { TICK_RATE_HZ } from '../shared/tempo';
import { botCommand } from './bot';
import { createSimulation } from './index';
import type { PlayerId, SimState } from './state';

export const BALANCE_SET_ID = 'soiree-v0';
export const BALANCE_SEEDS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const MAX_TICKS = 60_000;
const PLAYER_IDS: readonly PlayerId[] = [0, 1, 2, 3];

export interface GameResult {
  won: boolean;
  phrases: number;
  seconds: number;
  coreHp: number;
}

export interface TeamResult {
  team: readonly string[];
  won: number;
  phrases: number;
  seconds: number;
  coreHp: number;
}

export function playBot(
  team: readonly string[],
  seed: number,
  content: GameContent = CONTENT,
  maxTicks = MAX_TICKS,
): SimState {
  const players = team.map((classId, index) => ({ id: PLAYER_IDS[index] ?? 0, classId }));
  const simulation = createSimulation({ seed, setId: BALANCE_SET_ID, content, players });
  const { state } = simulation;
  while (state.tick < maxTicks && state.status !== 'won' && state.status !== 'lost') {
    simulation.step(players.map((player) => botCommand(state, content, player.id)));
  }
  return state;
}

export function resultOf(state: SimState): GameResult {
  return {
    won: state.status === 'won',
    phrases: state.stats.phrasesHeld,
    seconds: state.tick / TICK_RATE_HZ,
    coreHp: Math.max(0, state.core.hp),
  };
}

export function playTeam(
  team: readonly string[],
  seeds: readonly number[] = BALANCE_SEEDS,
  content: GameContent = CONTENT,
): TeamResult {
  const results = seeds.map((seed) => resultOf(playBot(team, seed, content)));
  const mean = (pick: (result: GameResult) => number) =>
    results.reduce((sum, result) => sum + pick(result), 0) / results.length;
  return {
    team,
    won: results.filter((result) => result.won).length,
    phrases: mean((result) => result.phrases),
    seconds: mean((result) => result.seconds),
    coreHp: mean((result) => result.coreHp),
  };
}

// Every team of 1 to `maxSize` players, a class repeated as often as it is chosen, in class order.
export function teamsOf(classIds: readonly string[], maxSize: number): string[][] {
  const teams: string[][] = [];
  const extend = (team: string[], from: number) => {
    if (team.length > 0) {
      teams.push(team);
    }
    if (team.length === maxSize) {
      return;
    }
    for (let index = from; index < classIds.length; index++) {
      extend([...team, classIds[index] ?? ''], index);
    }
  };
  extend([], 0);
  return teams.sort((a, b) => a.length - b.length);
}

export function balanceTable(results: readonly TeamResult[], seeds: number): string {
  const rows = results.map(
    (result) =>
      `| ${result.team.join(' + ')} | ${String(result.team.length)} | ${result.phrases.toFixed(1)} | ${result.seconds.toFixed(0)} | ${result.coreHp.toFixed(0)} | ${String(result.won)}/${String(seeds)} |`,
  );
  return [
    '| Équipe | Joueurs | Phrases tenues | Survie (s) | Vie du noyau | Victoires |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

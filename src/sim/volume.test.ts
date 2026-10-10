import { describe, expect, it } from 'vitest';
import type { SetDefinition } from '../data/types';
import { TICKS_PER_BAR } from '../shared/tempo';
import {
  COMBAT_OPTIONS,
  EFFECTS_CONTENT,
  EFFECTS_OPTIONS,
  FIXTURE_SET,
  actionsFor,
  stepAndRecord,
} from './fixtures';
import { createSimulation, type Simulation, type SimulationOptions } from './index';
import { scoreOf } from './score';
import type { PlayerState, SimState } from './state';

function game(
  volume: number,
  options: SimulationOptions = EFFECTS_OPTIONS,
): { simulation: Simulation; state: SimState; player: PlayerState } {
  const simulation = createSimulation(options);
  simulation.state.volume = volume;
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return { simulation, state: simulation.state, player };
}

const TRIPLE: SetDefinition = {
  ...FIXTURE_SET,
  tiers: FIXTURE_SET.tiers.map((tier) => ({
    ...tier,
    spawns: [{ enemyId: 'grump', everyBars: 1, count: 3, fromPhrase: 0 }],
  })),
};

const TRIPLE_OPTIONS: SimulationOptions = {
  ...EFFECTS_OPTIONS,
  content: { ...EFFECTS_CONTENT, sets: [TRIPLE] },
};

describe('Volume', () => {
  it('gives a bad vibe 125 % of its life at Volume 1', () => {
    const { simulation, state } = game(1, TRIPLE_OPTIONS);

    stepAndRecord(simulation, TICKS_PER_BAR);

    expect(state.enemies.length).toBeGreaterThan(0);
    expect(state.enemies.every((enemy) => enemy.maxHp === 25 && enemy.hp === 25)).toBe(true);
  });

  it('raises the life of the boss too', () => {
    const { simulation, state } = game(2, COMBAT_OPTIONS);
    const calm = game(0, COMBAT_OPTIONS);

    stepAndRecord(simulation, 18 * TICKS_PER_BAR + 1);
    stepAndRecord(calm.simulation, 18 * TICKS_PER_BAR + 1);

    const boss = state.enemies.find((enemy) => enemy.isBoss);
    const calmBoss = calm.state.enemies.find((enemy) => enemy.isBoss);
    expect(boss?.maxHp).toBe(1.5 * (calmBoss?.maxHp ?? Number.NaN));
  });

  it('makes a rule with count 3 spawn 4 bad vibes at Volume 1', () => {
    const calm = game(0, TRIPLE_OPTIONS);
    const loud = game(1, TRIPLE_OPTIONS);

    stepAndRecord(calm.simulation, TICKS_PER_BAR);
    stepAndRecord(loud.simulation, TICKS_PER_BAR);

    expect(calm.state.enemies).toHaveLength(3);
    expect(loud.state.enemies).toHaveLength(4);
  });

  it('gives 5 vibes for a pickup of 4 at Volume 1', () => {
    const { simulation, state, player } = game(1, COMBAT_OPTIONS);
    state.pickups.push({
      id: 900,
      kind: 'vibes',
      amount: 4,
      x: player.x,
      y: player.y,
      prevX: player.x,
      prevY: player.y,
      ticksLeft: 100,
    });

    stepAndRecord(simulation, 1);

    expect(player.vibes).toBe(5);
    expect(state.stats.vibesCollected).toBe(5);
  });

  it('opens a seventh trap slot at Volume 1', () => {
    const place = (simulation: Simulation, state: SimState) => {
      for (const player of state.players) {
        player.hand = Array.from({ length: 7 }, () => ({ trapId: 'mister' }));
      }
      for (let i = 0; i < 7; i++) {
        simulation.step([
          actionsFor(0, {
            type: 'placeTrap',
            trapId: 'mister',
            x: 100 + i * 50,
            y: 100,
            dx: 1,
            dy: 0,
          }),
        ]);
      }
      return state.traps.length;
    };
    const calm = game(0);
    const loud = game(1);

    expect(place(calm.simulation, calm.state)).toBe(6);
    expect(place(loud.simulation, loud.state)).toBe(7);
  });
});

describe('scoreOf', () => {
  it('is worth 1.25 times more at Volume 1 for the same final state', () => {
    const { state } = game(0);
    state.tick = 100 * 60;
    state.stats.phrasesHeld = 4;
    state.stats.kills = 80;

    const calm = scoreOf(state);
    state.volume = 1;
    const loud = scoreOf(state);

    expect(calm).toBeGreaterThan(0);
    expect(loud).toBe(calm * 1.25);
  });

  it('counts phrases held before the rest', () => {
    const { state } = game(0);
    state.stats.phrasesHeld = 1;
    const one = scoreOf(state);
    state.stats.phrasesHeld = 2;

    expect(scoreOf(state)).toBeGreaterThan(one);
  });
});

import { describe, expect, it } from 'vitest';
import type { EnemyDefinition, GameContent } from '../../data/types';
import { TICKS_PER_BAR } from '../../shared/tempo';
import { COMBAT_CONTENT, COMBAT_OPTIONS, FIXTURE_HORDE } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { EnemyState, PlayerState } from '../state';
import { spawnEnemy } from '../systems/spawning';

const [grump] = COMBAT_CONTENT.enemies;
if (grump === undefined) {
  throw new Error('expected the grump enemy');
}

const AWAKE_BARS = 1;
const SLEEP_BARS = 1;
const SLOW_FACTOR = 0.4;
const RADIUS = 150;

// Speed 0 keeps the enemy where it is placed: these tests isolate the special from steering.
const YAWNER: EnemyDefinition = {
  ...grump,
  id: 'yawner',
  speed: 0,
  special: {
    kind: 'yawn',
    radius: RADIUS,
    slowFactor: SLOW_FACTOR,
    awakeBars: AWAKE_BARS,
    sleepBars: SLEEP_BARS,
  },
};

const CONTENT: GameContent = {
  ...COMBAT_CONTENT,
  enemies: [...COMBAT_CONTENT.enemies, YAWNER],
};

function duo(): { simulation: Simulation; near: PlayerState; far: PlayerState } {
  const simulation = createSimulation({
    ...COMBAT_OPTIONS,
    content: CONTENT,
    players: [
      { id: 0, classId: 'raver' },
      { id: 1, classId: 'raver' },
    ],
  });
  const [near, far] = simulation.state.players;
  if (near === undefined || far === undefined) {
    throw new Error('expected two players');
  }
  park(near, 100, 100);
  park(far, 100 + RADIUS + near.radius + 50, 100);
  return { simulation, near, far };
}

function park(player: PlayerState, x: number, y: number): void {
  player.x = x;
  player.y = y;
  player.prevX = x;
  player.prevY = y;
}

function yawner(simulation: Simulation): EnemyState {
  return spawnEnemy(simulation.state, YAWNER, 100, 100, false);
}

function steps(simulation: Simulation, count: number): void {
  for (let i = 0; i < count; i++) {
    simulation.step([]);
  }
}

describe('yawn', () => {
  it('slows a player within radius while awake, not one farther away', () => {
    const { simulation, near, far } = duo();
    yawner(simulation);

    simulation.step([]);

    expect(near.slowFactor).toBe(SLOW_FACTOR);
    expect(far.slowFactor).toBeUndefined();
  });

  it('stops yawning and falls asleep in place after awakeBars measures, then wakes up and recommences', () => {
    const { simulation, near } = duo();
    const enemy = yawner(simulation);

    steps(simulation, AWAKE_BARS * TICKS_PER_BAR);
    const awake = { slowFactor: near.slowFactor, stunTicks: enemy.stunTicks };

    simulation.step([]);
    const justAsleep = { slowFactor: near.slowFactor, stunTicks: enemy.stunTicks };

    steps(simulation, SLEEP_BARS * TICKS_PER_BAR - 1);
    const stillAsleep = { slowFactor: near.slowFactor, stunTicks: enemy.stunTicks };

    simulation.step([]);
    const awokeAgain = { slowFactor: near.slowFactor, stunTicks: enemy.stunTicks };

    expect(awake).toEqual({ slowFactor: SLOW_FACTOR, stunTicks: 0 });
    expect(justAsleep.slowFactor).toBe(1);
    expect(justAsleep.stunTicks).toBeGreaterThan(0);
    expect(stillAsleep).toEqual({ slowFactor: 1, stunTicks: 0 });
    expect(awokeAgain).toEqual({ slowFactor: SLOW_FACTOR, stunTicks: 0 });
  });

  it('announces the yawn once, as the enemy falls asleep', () => {
    const { simulation } = duo();
    const enemy = yawner(simulation);
    const yawns = () => simulation.state.events.filter((event) => event.type === 'enemyYawned');

    steps(simulation, AWAKE_BARS * TICKS_PER_BAR);
    const beforeNap = yawns();
    simulation.step([]);
    const atNap = yawns();
    simulation.step([]);

    expect(beforeNap).toEqual([]);
    expect(atNap).toEqual([
      { type: 'enemyYawned', id: enemy.id, kind: 'yawner', x: enemy.x, y: enemy.y },
    ]);
    expect(yawns()).toEqual([]);
  });

  it('acts as an obstacle while asleep: a passing horde enemy separates away from it', () => {
    const simulation = createSimulation({ ...COMBAT_OPTIONS, content: CONTENT });
    const player = simulation.state.players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    park(player, 100, 800);
    const { core } = simulation.state;
    const sleepy = spawnEnemy(simulation.state, YAWNER, core.x - 2, 100, false);
    const mover = spawnEnemy(simulation.state, FIXTURE_HORDE, core.x + 2, 100, false);
    sleepy.stunTicks = 1000;

    steps(simulation, 5);

    expect({ x: sleepy.x, y: sleepy.y }).toEqual({ x: core.x - 2, y: 100 });
    expect(mover.x - sleepy.x).toBeGreaterThan(6);
  });
});

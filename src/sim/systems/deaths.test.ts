import { describe, expect, it } from 'vitest';
import {
  COMBAT_OPTIONS,
  FIXTURE_SET,
  actionsFor,
  commandFor,
  placeEnemy,
  stepAndRecord,
} from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { EnemyState, PlayerId, PlayerState, SimEvent } from '../state';

function arena(): Simulation {
  const simulation = createSimulation(COMBAT_OPTIONS);
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  player.x = 100;
  player.y = 800;
  return simulation;
}

describe('deaths', () => {
  it('remove a dead enemy, count the kill and credit the last player who hit it', () => {
    const simulation = arena();
    const { state } = simulation;
    const dead = placeEnemy(state, 'grump', 400, 100);
    const alive = placeEnemy(state, 'grump', 1200, 100);
    dead.hp = -3;
    dead.lastHitBy = 0;

    simulation.step([]);

    expect(state.enemies).toEqual([alive]);
    expect(state.stats.kills).toBe(1);
    expect(state.events).toContainEqual({
      type: 'enemyDied',
      id: dead.id,
      kind: 'grump',
      x: dead.x,
      y: dead.y,
      byPlayer: 0,
    });
  });

  it('credit no player for an enemy no player hit', () => {
    const simulation = arena();
    const dead = placeEnemy(simulation.state, 'grump', 400, 100);
    dead.hp = 0;

    simulation.step([]);

    expect(simulation.state.events).toContainEqual(
      expect.objectContaining({ type: 'enemyDied', byPlayer: null }),
    );
  });

  it('drop the vibes of the enemy where it fell, and no watts when it has none', () => {
    const simulation = arena();
    const dead = placeEnemy(simulation.state, 'grump', 400, 100);
    dead.hp = 0;

    simulation.step([]);

    expect(simulation.state.pickups).toEqual([
      expect.objectContaining({
        kind: 'vibes',
        amount: 1,
        x: dead.x,
        y: dead.y,
        ticksLeft: FIXTURE_SET.pickups.lifetimeTicks - 1,
      }),
    ]);
  });

  it('drop vibes and watts side by side when the enemy carries both', () => {
    const simulation = arena();
    const dead = placeEnemy(simulation.state, 'doorman', 400, 100);
    dead.hp = 0;

    simulation.step([]);

    expect(simulation.state.pickups).toEqual([
      expect.objectContaining({ kind: 'vibes', amount: 5, x: dead.x - 10, y: dead.y }),
      expect.objectContaining({ kind: 'watts', amount: 3, x: dead.x + 10, y: dead.y }),
    ]);
  });
});

describe('kill credit', () => {
  function duo(): { simulation: Simulation; second: PlayerState } {
    const simulation = createSimulation({
      ...COMBAT_OPTIONS,
      players: [
        { id: 0, classId: 'raver' },
        { id: 1, classId: 'raver' },
      ],
    });
    const second = simulation.state.players[1];
    if (second === undefined) {
      throw new Error('expected two players');
    }
    return { simulation, second };
  }

  function dying(simulation: Simulation, x: number, y: number): EnemyState {
    const enemy = placeEnemy(simulation.state, 'grump', x, y);
    enemy.hp = 1;
    enemy.stunTicks = 100_000;
    return enemy;
  }

  function creditFor(events: readonly SimEvent[], enemy: EnemyState): PlayerId | null | undefined {
    for (const event of events) {
      if (event.type === 'enemyDied' && event.id === enemy.id) {
        return event.byPlayer;
      }
    }
    return undefined;
  }

  it('goes to the owner of the bass bin that kills the enemy', () => {
    const { simulation } = duo();
    simulation.step([
      actionsFor(1, { type: 'placeTrap', trapId: 'subwoofer', x: 400, y: 300, dx: 1, dy: 0 }),
    ]);
    const enemy = dying(simulation, 450, 300);

    const recorded = stepAndRecord(simulation, 11);

    expect(
      creditFor(
        recorded.map(({ event }) => event),
        enemy,
      ),
    ).toBe(1);
  });

  it('goes to the owner of the trap whose projectile kills the enemy', () => {
    const { simulation } = duo();
    const { state } = simulation;
    simulation.step([
      actionsFor(1, { type: 'placeTrap', trapId: 'subwoofer', x: 400, y: 300, dx: 1, dy: 0 }),
    ]);
    const trapId = state.traps[0]?.id ?? -1;
    const enemy = dying(simulation, 400, 600);
    state.projectiles.push({
      id: 98,
      owner: { kind: 'trap', trapId },
      x: 400,
      y: 600,
      prevX: 400,
      prevY: 600,
      vx: 0,
      vy: 0,
      radius: 4,
      damage: 5,
      ticksLeft: 10,
      pierceLeft: 0,
    });

    simulation.step([]);

    expect(creditFor(state.events, enemy)).toBe(1);
  });

  it('goes to the player whose nova kills the enemy', () => {
    const { simulation, second } = duo();
    const enemy = dying(simulation, second.x, second.y - 50);

    simulation.step([commandFor(1, { skill: true })]);

    expect(creditFor(simulation.state.events, enemy)).toBe(1);
  });

  it('goes to the player whose laser show kills the enemy', () => {
    const { simulation, second } = duo();
    const enemy = dying(simulation, second.x, second.y - 50);
    simulation.state.laserShows = [
      { id: 99, playerId: 1, damagePerTick: 2, radius: 300, ticksLeft: 10 },
    ];

    simulation.step([]);

    expect(creditFor(simulation.state.events, enemy)).toBe(1);
  });

  it('goes to the last player who hit the enemy, whatever hit it', () => {
    const { simulation, second } = duo();
    const enemy = dying(simulation, second.x, second.y - 50);
    enemy.hp = 31;
    enemy.lastHitBy = 0;

    simulation.step([commandFor(1, { skill: true })]);

    expect(enemy.lastHitBy).toBe(1);
  });
});

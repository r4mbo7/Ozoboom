import { describe, expect, it } from 'vitest';
import { COMBAT_OPTIONS, placeEnemy } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import { PICKUP_LIFETIME_TICKS } from './deaths';

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
        ticksLeft: PICKUP_LIFETIME_TICKS - 1,
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

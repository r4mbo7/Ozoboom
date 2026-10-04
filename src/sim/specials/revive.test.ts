import { describe, expect, it } from 'vitest';
import type { EnemyDefinition, GameContent } from '../../data/types';
import { TICKS_PER_BAR } from '../../shared/tempo';
import { hurtEnemy } from '../effects';
import { COMBAT_CONTENT, COMBAT_OPTIONS } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { EnemyState } from '../state';
import { spawnEnemy } from '../systems/spawning';

const [grump] = COMBAT_CONTENT.enemies;
if (grump === undefined) {
  throw new Error('expected the grump enemy');
}

const DOWN_BARS = 1;
const HP_RATIO = 0.5;
const DOWN_TICKS = DOWN_BARS * TICKS_PER_BAR;

const ZOMBIE: EnemyDefinition = {
  ...grump,
  id: 'zombie',
  special: { kind: 'revive', times: 1, hpRatio: HP_RATIO, downBars: DOWN_BARS },
};

const CONTENT: GameContent = {
  ...COMBAT_CONTENT,
  enemies: [...COMBAT_CONTENT.enemies, ZOMBIE],
};

function arena(): Simulation {
  return createSimulation({ ...COMBAT_OPTIONS, content: CONTENT });
}

function zombie(simulation: Simulation, x: number, y: number): EnemyState {
  return spawnEnemy(simulation.state, ZOMBIE, x, y, false);
}

function steps(simulation: Simulation, count: number): void {
  for (let i = 0; i < count; i++) {
    simulation.step([]);
  }
}

describe('revive', () => {
  it('stays on the ground instead of dying when it reaches 0 hp with a revive left', () => {
    const simulation = arena();
    const enemy = zombie(simulation, 400, 100);
    enemy.hp = 0;

    simulation.step([]);

    expect(simulation.state.enemies).toContain(enemy);
    expect(simulation.state.stats.kills).toBe(0);
    expect(simulation.state.events).not.toContainEqual(
      expect.objectContaining({ type: 'enemyDied' }),
    );
    expect(simulation.state.pickups).toEqual([]);
  });

  it('takes no damage while down', () => {
    const simulation = arena();
    const enemy = zombie(simulation, 400, 100);
    enemy.hp = 0;
    simulation.step([]);

    hurtEnemy(simulation.state, enemy, 50, 1, null);

    expect(enemy.hp).toBe(0);
  });

  it('does not move or attack while down', () => {
    const simulation = arena();
    const { players } = simulation.state;
    const player = players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    const enemy = zombie(simulation, player.x + player.radius + grump.radius, player.y);
    enemy.hp = 0;
    const position = { x: enemy.x, y: enemy.y };
    const playerHp = player.hp;

    steps(simulation, DOWN_TICKS - 1);

    expect({ x: enemy.x, y: enemy.y }).toEqual(position);
    expect(player.hp).toBe(playerHp);
  });

  it('revives at hpRatio of its max hp after downBars measures, and dies for good the next time', () => {
    const simulation = arena();
    const enemy = zombie(simulation, 400, 100);
    enemy.hp = -5;

    simulation.step([]);
    steps(simulation, DOWN_TICKS - 1);
    const stillDown = simulation.state.enemies.includes(enemy);

    simulation.step([]);

    expect(stillDown).toBe(true);
    expect(enemy.hp).toBe(enemy.maxHp * HP_RATIO);
    expect(simulation.state.events).toContainEqual({
      type: 'enemyRevived',
      id: enemy.id,
      kind: 'zombie',
      x: enemy.x,
      y: enemy.y,
    });
    expect(simulation.state.stats.kills).toBe(0);

    enemy.hp = 0;
    simulation.step([]);

    expect(simulation.state.enemies).not.toContain(enemy);
    expect(simulation.state.stats.kills).toBe(1);
    expect(simulation.state.events).toContainEqual(
      expect.objectContaining({ type: 'enemyDied', id: enemy.id }),
    );
  });
});

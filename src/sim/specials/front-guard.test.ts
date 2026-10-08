import { describe, expect, it } from 'vitest';
import type { EnemyDefinition } from '../../data/types';
import { hurtEnemy } from '../effects';
import { COMBAT_CONTENT, COMBAT_OPTIONS } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { EnemyState } from '../state';
import { spawnEnemy } from '../systems/spawning';

const GUARD: EnemyDefinition = {
  id: 'bouncer-alpha',
  name: 'Videur alpha',
  behaviour: 'heavy',
  maxHp: 1000,
  speed: 2,
  radius: 20,
  damage: 12,
  attackCooldownTicks: 36,
  aggroRadius: 1,
  vibesDrop: 5,
  wattsDrop: 3,
  scalingPerPhrase: { hp: 1, speed: 1 },
  special: { kind: 'frontGuard', frontDamageMul: 0.5 },
};

function walkingGuard(): { simulation: Simulation; guard: EnemyState; dx: number; dy: number } {
  const simulation = createSimulation({
    ...COMBAT_OPTIONS,
    content: { ...COMBAT_CONTENT, enemies: [...COMBAT_CONTENT.enemies, GUARD] },
  });
  const guard = spawnEnemy(simulation.state, GUARD, 100, 100, false);
  simulation.step([]);
  const stepX = guard.x - guard.prevX;
  const stepY = guard.y - guard.prevY;
  const length = Math.sqrt(stepX * stepX + stepY * stepY);
  return {
    simulation,
    guard,
    dx: stepX / length,
    dy: stepY / length,
  };
}

function damageFrom(
  simulation: Simulation,
  guard: EnemyState,
  from: { x: number; y: number } | null,
): number {
  const before = guard.hp;
  hurtEnemy(simulation.state, guard, 10, 1, null, from);
  return before - guard.hp;
}

describe('frontGuard', () => {
  it('takes half damage from a source in front of its last step', () => {
    const { simulation, guard, dx, dy } = walkingGuard();

    const dealt = damageFrom(simulation, guard, { x: guard.x + dx * 50, y: guard.y + dy * 50 });

    expect(dealt).toBe(5);
    expect(simulation.state.events).toContainEqual(
      expect.objectContaining({ type: 'enemyHit', id: guard.id, damage: 5, front: true }),
    );
  });

  it('takes full damage from behind and from the side', () => {
    const { simulation, guard, dx, dy } = walkingGuard();

    const behind = damageFrom(simulation, guard, { x: guard.x - dx * 50, y: guard.y - dy * 50 });
    const side = damageFrom(simulation, guard, { x: guard.x - dy * 50, y: guard.y + dx * 50 });

    expect(behind).toBe(10);
    expect(side).toBe(10);
    expect(simulation.state.events).not.toContainEqual(expect.objectContaining({ front: true }));
  });

  it('has no front while standing still', () => {
    const { simulation, guard, dx, dy } = walkingGuard();
    guard.stunTicks = 10;
    simulation.step([]);

    const dealt = damageFrom(simulation, guard, { x: guard.x + dx * 50, y: guard.y + dy * 50 });

    expect(dealt).toBe(10);
  });

  it('takes full damage from a hit without a source position', () => {
    const { simulation, guard } = walkingGuard();

    expect(damageFrom(simulation, guard, null)).toBe(10);
  });

  it('takes full damage before its first step', () => {
    const simulation = createSimulation({
      ...COMBAT_OPTIONS,
      content: { ...COMBAT_CONTENT, enemies: [...COMBAT_CONTENT.enemies, GUARD] },
    });
    const guard = spawnEnemy(simulation.state, GUARD, 100, 100, false);

    expect(damageFrom(simulation, guard, { x: 200, y: 200 })).toBe(10);
  });
});

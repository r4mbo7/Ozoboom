import { describe, expect, it } from 'vitest';
import type { ClassDefinition, EnemyDefinition, GameContent } from '../../data/types';
import { COMBAT_CONTENT, COMBAT_OPTIONS } from '../fixtures';
import { createSimulation } from '../index';
import { applyModifiers, refreshDerivedStats } from '../stats';
import { spawnEnemy } from '../systems/spawning';

function raverClass(): ClassDefinition {
  const [raver] = COMBAT_CONTENT.classes;
  if (raver === undefined) {
    throw new Error('expected the raver class');
  }
  return raver;
}

const RAVER = raverClass();

const NAGGER: EnemyDefinition = {
  id: 'nagger',
  name: 'Nagger',
  behaviour: 'rusher',
  maxHp: 20,
  speed: 0,
  radius: 10,
  damage: 0,
  attackCooldownTicks: 24,
  aggroRadius: 0,
  vibesDrop: 0,
  scalingPerPhrase: { hp: 1, speed: 1 },
  special: { kind: 'suppress', radius: 80 },
};

const SUPPRESS_CONTENT: GameContent = {
  ...COMBAT_CONTENT,
  enemies: [...COMBAT_CONTENT.enemies, NAGGER],
};

function setup() {
  const simulation = createSimulation({ ...COMBAT_OPTIONS, content: SUPPRESS_CONTENT });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  applyModifiers(player, [{ stat: 'speedMul', mul: 1.3 }]);
  refreshDerivedStats(player, RAVER);
  const enemy = spawnEnemy(simulation.state, NAGGER, player.x + 30, player.y, false);
  return { simulation, player, enemy };
}

describe('suppress', () => {
  it('holds a player at base speed while inside its radius, without touching current hp', () => {
    const { simulation, player } = setup();
    const boostedSpeed = RAVER.speed * 1.3;
    expect(player.speed).toBeCloseTo(boostedSpeed);
    const hpBeforeEntering = player.hp;

    simulation.step([]);

    expect(player.speed).toBe(RAVER.speed);
    expect(player.hp).toBe(hpBeforeEntering);
  });

  it('keeps the player suppressed for one tick after it leaves the radius, then restores the boosted speed', () => {
    const { simulation, player, enemy } = setup();
    const boostedSpeed = RAVER.speed * 1.3;
    simulation.step([]);
    enemy.x = player.x + 1_000;
    const hpBeforeLeaving = player.hp;

    simulation.step([]);
    expect(player.speed).toBe(RAVER.speed);

    simulation.step([]);
    expect(player.speed).toBe(boostedSpeed);
    expect(player.hp).toBe(hpBeforeLeaving);
  });
});

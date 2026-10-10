import { describe, expect, it } from 'vitest';
import type { EnemyDefinition, GameContent } from '../../data/types';
import { COMBAT_CONTENT, COMBAT_OPTIONS } from '../fixtures';
import { createSimulation } from '../index';
import { spawnEnemy } from '../systems/spawning';

const CAMCORDER: EnemyDefinition = {
  id: 'camcorder',
  name: 'Camcorder',
  behaviour: 'rusher',
  maxHp: 20,
  speed: 0,
  radius: 10,
  damage: 0,
  attackCooldownTicks: 24,
  aggroRadius: 0,
  vibesDrop: 0,
  scalingPerPhrase: { hp: 1, speed: 1 },
  special: { kind: 'dazzle', radius: 80 },
};

const DAZZLE_CONTENT: GameContent = {
  ...COMBAT_CONTENT,
  enemies: [...COMBAT_CONTENT.enemies, CAMCORDER],
};

function setup() {
  const simulation = createSimulation({ ...COMBAT_OPTIONS, content: DAZZLE_CONTENT });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  const enemy = spawnEnemy(simulation.state, CAMCORDER, player.x + 30, player.y, false);
  return { simulation, player, enemy };
}

describe('dazzle', () => {
  it('sets dazzledTicks on a player inside its radius', () => {
    const { simulation, player } = setup();

    simulation.step([]);

    expect(player.dazzledTicks).toBeGreaterThan(0);
  });

  it('leaves a player outside its radius unaffected', () => {
    const { simulation, player, enemy } = setup();
    enemy.x = player.x + 1_000;

    simulation.step([]);

    expect(player.dazzledTicks).toBeUndefined();
  });

  it('falls back to zero two ticks after the player leaves the radius', () => {
    const { simulation, player, enemy } = setup();
    simulation.step([]);
    expect(player.dazzledTicks).toBeGreaterThan(0);

    enemy.x = player.x + 1_000;
    simulation.step([]);
    expect(player.dazzledTicks).toBeGreaterThan(0);

    simulation.step([]);
    expect(player.dazzledTicks).toBe(0);
  });
});

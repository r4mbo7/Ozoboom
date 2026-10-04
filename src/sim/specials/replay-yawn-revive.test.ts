import { describe, expect, it } from 'vitest';
import type { EnemyDefinition, GameContent } from '../../data/types';
import { COMBAT_CONTENT, COMBAT_OPTIONS, commandFor } from '../fixtures';
import { createSimulation } from '../index';
import { hashState } from '../replay';
import { spawnEnemy } from '../systems/spawning';

const [grump] = COMBAT_CONTENT.enemies;
if (grump === undefined) {
  throw new Error('expected the grump enemy');
}

const YAWNER: EnemyDefinition = {
  ...grump,
  id: 'yawner',
  special: { kind: 'yawn', radius: 150, slowFactor: 0.4, awakeBars: 1, sleepBars: 1 },
};

const ZOMBIE: EnemyDefinition = {
  ...grump,
  id: 'zombie',
  special: { kind: 'revive', times: 1, hpRatio: 0.5, downBars: 1 },
};

const CONTENT: GameContent = {
  ...COMBAT_CONTENT,
  enemies: [...COMBAT_CONTENT.enemies, YAWNER, ZOMBIE],
};

const REFERENCE_HASH = '88d7f6e0';

describe('replay with the Fatigué and the Zombie', () => {
  it('keeps the fingerprint of a scripted game across the yawn and revive cycles', () => {
    const simulation = createSimulation({ ...COMBAT_OPTIONS, content: CONTENT });
    const { state } = simulation;
    const player = state.players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    const yawner = spawnEnemy(state, YAWNER, player.x + 80, player.y, false);
    const zombie = spawnEnemy(state, ZOMBIE, player.x - 80, player.y, false);

    for (let tick = 0; tick < 300; tick++) {
      if (tick === 60) {
        zombie.hp = 0;
      }
      simulation.step([
        commandFor(player.id, {
          move: { x: tick % 2 === 0 ? 1 : -1, y: 0 },
          aim: { x: 0, y: -1 },
        }),
      ]);
    }

    expect(state.enemies).toContain(yawner);
    expect(state.enemies).toContain(zombie);
    expect(zombie.hp).toBeGreaterThan(0);
    expect(hashState(state)).toBe(REFERENCE_HASH);
  });
});

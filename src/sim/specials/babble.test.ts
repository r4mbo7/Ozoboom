import { describe, expect, it } from 'vitest';
import type { EnemyDefinition, GameContent } from '../../data/types';
import { TICKS_PER_BAR } from '../../shared/tempo';
import { COMBAT_CONTENT, COMBAT_OPTIONS, stepAndRecord } from '../fixtures';
import { createSimulation } from '../index';
import { spawnEnemy } from '../systems/spawning';

const CHATTERER: EnemyDefinition = {
  id: 'chatterer',
  name: 'Chatterer',
  behaviour: 'rusher',
  maxHp: 20,
  speed: 0,
  radius: 10,
  damage: 0,
  attackCooldownTicks: 24,
  aggroRadius: 0,
  vibesDrop: 0,
  scalingPerPhrase: { hp: 1, speed: 1 },
  special: { kind: 'babble', everyBars: 3 },
};

const BABBLE_CONTENT: GameContent = {
  ...COMBAT_CONTENT,
  enemies: [...COMBAT_CONTENT.enemies, CHATTERER],
};

describe('babble', () => {
  it('posts exactly one enemyBabbled event every everyBars bars, on the bar', () => {
    const simulation = createSimulation({ ...COMBAT_OPTIONS, content: BABBLE_CONTENT });
    const player = simulation.state.players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    const chatterer = spawnEnemy(simulation.state, CHATTERER, player.x, player.y, false);

    const recorded = stepAndRecord(simulation, 8 * TICKS_PER_BAR + 1);

    expect(
      recorded
        .filter(({ event }) => event.type === 'enemyBabbled')
        .map(({ tick, event }) => ({
          tick,
          id: event.type === 'enemyBabbled' ? event.id : undefined,
        })),
    ).toEqual([
      { tick: 3 * TICKS_PER_BAR, id: chatterer.id },
      { tick: 6 * TICKS_PER_BAR, id: chatterer.id },
    ]);
  });
});

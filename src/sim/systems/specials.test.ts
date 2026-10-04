import { describe, expect, it } from 'vitest';
import type { EnemyDefinition, GameContent } from '../../data/types';
import { FIXTURE_CONTENT, FIXTURE_OPTIONS } from '../fixtures';
import { createSimulation } from '../index';
import type { PlayerState } from '../state';
import { spawnEnemy } from './spawning';

const [grump] = FIXTURE_CONTENT.enemies;
if (grump === undefined) {
  throw new Error('expected the grump enemy');
}

const WHINER: EnemyDefinition = {
  ...grump,
  id: 'whiner',
  special: { kind: 'sigh', slowFactor: 0.5, durationTicks: 20 },
};

const SPECIAL_CONTENT: GameContent = {
  ...FIXTURE_CONTENT,
  enemies: [...FIXTURE_CONTENT.enemies, WHINER],
};

function soloPlayer(content: GameContent = FIXTURE_CONTENT): {
  simulation: ReturnType<typeof createSimulation>;
  player: PlayerState;
} {
  const simulation = createSimulation({ ...FIXTURE_OPTIONS, content });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return { simulation, player };
}

describe('specials', () => {
  it('leaves slowFactor, suppressedTicks and dazzledTicks unset without a special effect to set them', () => {
    const { simulation, player } = soloPlayer();

    simulation.step([]);

    expect(player.slowFactor).toBeUndefined();
    expect(player.suppressedTicks).toBeUndefined();
    expect(player.dazzledTicks).toBeUndefined();
  });

  it('resets an already set slowFactor to 1 each step', () => {
    const { simulation, player } = soloPlayer();
    player.slowFactor = 0.4;

    simulation.step([]);

    expect(player.slowFactor).toBe(1);
  });

  it('decrements suppressedTicks and dazzledTicks, clamped at zero', () => {
    const { simulation, player } = soloPlayer();
    player.suppressedTicks = 1;
    player.dazzledTicks = 0;

    simulation.step([]);

    expect(player.suppressedTicks).toBe(0);
    expect(player.dazzledTicks).toBe(0);
  });

  it('dispatches to the registered module of a bad vibe with a special effect, without crashing', () => {
    const { simulation } = soloPlayer(SPECIAL_CONTENT);
    spawnEnemy(simulation.state, WHINER, 100, 100, false);

    expect(() => {
      simulation.step([]);
    }).not.toThrow();
  });
});

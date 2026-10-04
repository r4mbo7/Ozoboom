import { describe, expect, it } from 'vitest';
import type { EnemyDefinition, GameContent } from '../../data/types';
import { FIXTURE_CONTENT, FIXTURE_OPTIONS } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { PlayerState } from '../state';
import { spawnEnemy } from '../systems/spawning';

const [grump] = FIXTURE_CONTENT.enemies;
if (grump === undefined) {
  throw new Error('expected the grump enemy');
}

const BOUNCER: EnemyDefinition = {
  ...grump,
  id: 'bouncer-shove',
  special: { kind: 'shove', knockback: 40 },
};

const SHOVE_CONTENT: GameContent = {
  ...FIXTURE_CONTENT,
  enemies: [...FIXTURE_CONTENT.enemies, BOUNCER],
};

function soloPlayer(): { simulation: Simulation; player: PlayerState } {
  const simulation = createSimulation({ ...FIXTURE_OPTIONS, content: SHOVE_CONTENT });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return { simulation, player };
}

describe('shove', () => {
  it('pushes a touched player back by its knockback distance', () => {
    const { simulation, player } = soloPlayer();
    player.x = 500;
    player.y = 500;
    const enemy = spawnEnemy(
      simulation.state,
      BOUNCER,
      player.x - player.radius - BOUNCER.radius,
      player.y,
      false,
    );

    simulation.step([]);

    expect(player.x).toBeCloseTo(540);
    expect(player.y).toBeCloseTo(500);
    expect(simulation.state.events).toContainEqual({
      type: 'playerShoved',
      id: enemy.id,
      kind: enemy.kind,
      playerId: player.id,
      x: enemy.x,
      y: enemy.y,
    });
  });

  it('never pushes a player outside the arena', () => {
    const { simulation, player } = soloPlayer();
    player.x = player.radius + 5;
    player.y = 500;
    spawnEnemy(
      simulation.state,
      BOUNCER,
      player.x + player.radius + BOUNCER.radius,
      player.y,
      false,
    );

    simulation.step([]);

    expect(player.x).toBe(player.radius);
  });

  it('leaves an untouched player alone', () => {
    const { simulation, player } = soloPlayer();
    player.x = 500;
    player.y = 500;
    spawnEnemy(simulation.state, BOUNCER, player.x - 400, player.y, false);

    simulation.step([]);

    expect(player.x).toBe(500);
    expect(simulation.state.events).not.toContainEqual(
      expect.objectContaining({ type: 'playerShoved' }),
    );
  });
});

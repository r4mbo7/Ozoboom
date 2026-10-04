import { describe, expect, it } from 'vitest';
import type { EnemyDefinition, GameContent } from '../../data/types';
import { FIXTURE_CONTENT, FIXTURE_OPTIONS } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { PlayerState, ProjectileOwner } from '../state';
import { spawnEnemy } from '../systems/spawning';

const [grump] = FIXTURE_CONTENT.enemies;
if (grump === undefined) {
  throw new Error('expected the grump enemy');
}

const WHINER_LONG: EnemyDefinition = {
  ...grump,
  id: 'whiner-long',
  special: { kind: 'sigh', slowFactor: 0.4, durationTicks: 20 },
};

const WHINER_SHORT: EnemyDefinition = {
  ...grump,
  id: 'whiner-short',
  special: { kind: 'sigh', slowFactor: 0.7, durationTicks: 5 },
};

const SIGH_CONTENT: GameContent = {
  ...FIXTURE_CONTENT,
  enemies: [...FIXTURE_CONTENT.enemies, WHINER_LONG, WHINER_SHORT],
};

function soloPlayer(): { simulation: Simulation; player: PlayerState } {
  const simulation = createSimulation({ ...FIXTURE_OPTIONS, content: SIGH_CONTENT });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  player.x = 500;
  player.y = 500;
  return { simulation, player };
}

// Placed one tick's velocity short of the player, so the first step both resolves the hit
// (`projectiles`) and lets the sighing module predict it (`specials`, which runs first).
function fireAt(simulation: Simulation, enemyId: number, player: PlayerState): void {
  const owner: ProjectileOwner = { kind: 'enemy', enemyId };
  const { state } = simulation;
  state.projectiles.push({
    id: state.nextEntityId,
    owner,
    x: player.x - 5,
    y: player.y,
    prevX: player.x - 5,
    prevY: player.y,
    vx: 5,
    vy: 0,
    radius: 4,
    damage: 5,
    ticksLeft: 50,
    pierceLeft: 0,
  });
  state.nextEntityId += 1;
}

describe('sigh', () => {
  it('slows a touched player for its duration, then back to normal speed, without touching damage', () => {
    const { simulation, player } = soloPlayer();
    const whiner = spawnEnemy(simulation.state, WHINER_LONG, 10, 10, false);
    fireAt(simulation, whiner.id, player);
    const hpBefore = player.hp;

    simulation.step([]);

    expect(player.slowFactor).toBe(0.4);
    expect(hpBefore - player.hp).toBe(5);
    expect(simulation.state.projectiles).toEqual([]);

    for (let i = 0; i < 19; i++) {
      simulation.step([]);
    }
    expect(simulation.state.tick).toBe(20);
    expect(player.slowFactor).toBe(0.4);

    simulation.step([]);

    expect(simulation.state.tick).toBe(21);
    expect(player.slowFactor).toBe(1);
  });

  it('does not stack two sighs on the same player: the longer one wins', () => {
    const { simulation, player } = soloPlayer();
    const long = spawnEnemy(simulation.state, WHINER_LONG, 10, 10, false);
    const short = spawnEnemy(simulation.state, WHINER_SHORT, 20, 20, false);
    fireAt(simulation, long.id, player);
    fireAt(simulation, short.id, player);

    simulation.step([]);

    expect(player.slowFactor).toBe(0.4);

    for (let i = 0; i < 19; i++) {
      simulation.step([]);
    }
    expect(simulation.state.tick).toBe(20);
    expect(player.slowFactor).toBe(0.4);

    simulation.step([]);

    expect(player.slowFactor).toBe(1);
  });

  it('leaves a player alone while no sigh projectile is about to touch them', () => {
    const { simulation, player } = soloPlayer();
    spawnEnemy(simulation.state, WHINER_LONG, 10, 10, false);

    simulation.step([]);

    expect(player.slowFactor).toBeUndefined();
  });
});

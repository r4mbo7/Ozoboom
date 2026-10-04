import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR } from '../../shared/tempo';
import { hurtEnemy } from '../effects';
import { COMBAT_OPTIONS, placeEnemy } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { PlayerState } from '../state';

function arena(): { simulation: Simulation; player: PlayerState } {
  const simulation = createSimulation(COMBAT_OPTIONS);
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return { simulation, player };
}

function park(
  entity: { x: number; y: number; prevX: number; prevY: number },
  x: number,
  y: number,
): void {
  entity.x = x;
  entity.y = y;
  entity.prevX = x;
  entity.prevY = y;
}

function steps(simulation: Simulation, count: number): void {
  for (let i = 0; i < count; i++) {
    simulation.step([]);
  }
}

describe('cling', () => {
  it('attaches to the player it touches, slows them and stops attacking', () => {
    const { simulation, player } = arena();
    park(player, 400, 400);
    const clinger = placeEnemy(
      simulation.state,
      'clinger',
      player.x + player.radius + 12 - 1,
      player.y,
    );

    simulation.step([]);

    expect(clinger.clingingTo).toBe(player.id);
    expect(player.slowFactor).toBe(0.5);
    expect(player.hp).toBe(100);
  });

  it('keeps following its player once attached, ignoring the leash', () => {
    const { simulation, player } = arena();
    park(player, 400, 400);
    const clinger = placeEnemy(
      simulation.state,
      'clinger',
      player.x + player.radius + 12 - 1,
      player.y,
    );

    simulation.step([]);
    park(player, 1200, 100);
    steps(simulation, 400);

    expect(clinger.clingingTo).toBe(player.id);
    expect(Math.abs(clinger.x - player.x) + Math.abs(clinger.y - player.y)).toBeLessThan(40);
  });

  it('detaches after a hit of at least detachDamage and will not reattach for a bar', () => {
    const { simulation, player } = arena();
    park(player, 400, 400);
    const clinger = placeEnemy(
      simulation.state,
      'clinger',
      player.x + player.radius + 12 - 1,
      player.y,
    );
    simulation.step([]);
    expect(clinger.clingingTo).toBe(player.id);

    hurtEnemy(simulation.state, clinger, 8, 1, player.id);
    simulation.step([]);

    expect(clinger.clingingTo).toBeUndefined();

    steps(simulation, TICKS_PER_BAR - 1);
    expect(clinger.clingingTo).toBeUndefined();
    steps(simulation, 1);
    expect(clinger.clingingTo).toBe(player.id);
  });

  it('stays attached when a hit is below detachDamage', () => {
    const { simulation, player } = arena();
    park(player, 400, 400);
    const clinger = placeEnemy(
      simulation.state,
      'clinger',
      player.x + player.radius + 12 - 1,
      player.y,
    );
    simulation.step([]);

    hurtEnemy(simulation.state, clinger, 3, 1, player.id);
    simulation.step([]);

    expect(clinger.clingingTo).toBe(player.id);
  });

  it('leaves a second clinger waiting beside a player who already has one', () => {
    const { simulation, player } = arena();
    park(player, 400, 400);
    const first = placeEnemy(
      simulation.state,
      'clinger',
      player.x + player.radius + 12 - 1,
      player.y,
    );
    simulation.step([]);
    expect(first.clingingTo).toBe(player.id);

    const second = placeEnemy(
      simulation.state,
      'clinger',
      player.x - player.radius - 12 + 1,
      player.y,
    );
    simulation.step([]);

    expect(second.clingingTo).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { COMBAT_OPTIONS, placeEnemy } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { PickupState, PlayerState } from '../state';

function arena(): { simulation: Simulation; player: PlayerState } {
  const simulation = createSimulation(COMBAT_OPTIONS);
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  park(player, 20, 20);
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

function dropVibes(simulation: Simulation, x: number, y: number, amount: number): PickupState {
  const pickup: PickupState = {
    id: 9001,
    kind: 'vibes',
    amount,
    x,
    y,
    prevX: x,
    prevY: y,
    ticksLeft: 10_000,
  };
  simulation.state.pickups.push(pickup);
  return pickup;
}

describe('steal', () => {
  it('goes to the nearest vibes pickup and absorbs it on contact', () => {
    const { simulation } = arena();
    const thief = placeEnemy(simulation.state, 'grifter', 800, 100);
    dropVibes(simulation, 900, 100, 7);

    let stolen = false;
    for (let i = 0; i < 200 && !stolen; i++) {
      simulation.step([]);
      stolen = simulation.state.events.some((event) => event.type === 'vibesStolen');
    }

    expect(stolen).toBe(true);
    expect(thief.carrying).toBe(7);
    expect(thief.fleeing).toBe(true);
    expect(simulation.state.pickups).toHaveLength(0);
  });

  it('flees to the nearest edge at fleeSpeedMul and disappears with its loot once there', () => {
    const { simulation } = arena();
    const { arena: bounds } = simulation.state;
    const thief = placeEnemy(simulation.state, 'grifter', 40, bounds.height / 2);
    dropVibes(simulation, 70, bounds.height / 2, 5);

    const recorded: typeof simulation.state.events = [];
    for (let i = 0; i < 200 && simulation.state.enemies.includes(thief); i++) {
      simulation.step([]);
      recorded.push(...simulation.state.events);
    }

    expect(recorded.some((event) => event.type === 'vibesStolen')).toBe(true);
    expect(simulation.state.enemies).not.toContain(thief);
    expect(recorded.filter((event) => event.type === 'enemyFled')).toEqual([
      { type: 'enemyFled', id: thief.id, kind: 'grifter', x: 12, y: bounds.height / 2 },
    ]);
    expect(simulation.state.pickups).toHaveLength(0);
    expect(simulation.state.stats.kills).toBe(0);
  });

  it('drops exactly what it carried when a player catches it while fleeing', () => {
    const { simulation, player } = arena();
    const { arena: bounds } = simulation.state;
    const thief = placeEnemy(simulation.state, 'grifter', bounds.width / 2, bounds.height / 2);
    dropVibes(simulation, bounds.width / 2 + 20, bounds.height / 2, 6);

    for (let i = 0; i < 50 && thief.fleeing !== true; i++) {
      simulation.step([]);
    }
    expect(thief.fleeing).toBe(true);
    expect(thief.carrying).toBe(6);

    // The player stands right where the thief drops its loot, so it collects it the same tick:
    // the dropped pickup still shows up, as the pickup the thief returned.
    park(player, thief.x, thief.y);
    const vibesBefore = player.vibes;
    simulation.step([]);

    expect(thief.fleeing).toBe(false);
    expect(thief.carrying).toBe(0);
    expect(player.vibes).toBe(vibesBefore + 6);
    expect(simulation.state.events).toContainEqual({
      type: 'pickupCollected',
      playerId: player.id,
      kind: 'vibes',
      amount: 6,
    });
  });

  it('dies normally and drops its loot with its own vibes when killed while fleeing', () => {
    const { simulation } = arena();
    const { arena: bounds } = simulation.state;
    const thief = placeEnemy(simulation.state, 'grifter', bounds.width / 2, bounds.height / 2);
    dropVibes(simulation, bounds.width / 2 + 20, bounds.height / 2, 6);
    for (let i = 0; i < 50 && thief.fleeing !== true; i++) {
      simulation.step([]);
    }
    expect(thief.fleeing).toBe(true);
    const ownDrop =
      COMBAT_OPTIONS.content.enemies.find((enemy) => enemy.id === 'grifter')?.vibesDrop ?? 0;

    thief.hp = 0;
    simulation.step([]);

    const { state } = simulation;
    expect(state.enemies).not.toContain(thief);
    expect(state.events.some((event) => event.type === 'enemyFled')).toBe(false);
    expect(state.events.some((event) => event.type === 'enemyDied' && event.id === thief.id)).toBe(
      true,
    );
    expect(state.stats.kills).toBe(1);
    expect(state.pickups.reduce((sum, pickup) => sum + pickup.amount, 0)).toBe(6 + ownDrop);
  });
});

import { describe, expect, it } from 'vitest';
import { COMBAT_CONTENT, COMBAT_OPTIONS, stepAndRecord } from '../fixtures';
import { createSimulation, type Simulation, type SimulationOptions } from '../index';
import type { PickupKind, PickupState, PlayerState, SimState } from '../state';

const [COMBAT_SET] = COMBAT_CONTENT.sets;
if (COMBAT_SET === undefined) {
  throw new Error('expected the combat set');
}
const PICKUP_SPEED = COMBAT_SET.pickups.speed;

function arena(options: SimulationOptions = COMBAT_OPTIONS): {
  simulation: Simulation;
  player: PlayerState;
} {
  const simulation = createSimulation(options);
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  player.x = 400;
  player.y = 400;
  return { simulation, player };
}

function drop(
  state: SimState,
  kind: PickupKind,
  x: number,
  y: number,
  ticksLeft = 100,
): PickupState {
  const pickup: PickupState = {
    id: state.nextEntityId,
    kind,
    amount: 3,
    x,
    y,
    prevX: x,
    prevY: y,
    ticksLeft,
  };
  state.nextEntityId += 1;
  state.pickups.push(pickup);
  return pickup;
}

describe('pickups', () => {
  it('fly to a player who comes within the pickup radius of their class', () => {
    const { simulation } = arena();
    const pickup = drop(simulation.state, 'vibes', 400 + 60, 400);
    const outOfReach = drop(simulation.state, 'vibes', 400, 400 + 61);

    simulation.step([]);

    expect(pickup).toMatchObject({ x: 460 - PICKUP_SPEED, y: 400 });
    expect(outOfReach).toMatchObject({ x: 400, y: 461 });
  });

  it('fly at the pickup speed of the set', () => {
    const { simulation } = arena({
      ...COMBAT_OPTIONS,
      content: {
        ...COMBAT_CONTENT,
        sets: [{ ...COMBAT_SET, pickups: { ...COMBAT_SET.pickups, speed: 5 } }],
      },
    });
    const pickup = drop(simulation.state, 'vibes', 400 + 60, 400);

    simulation.step([]);

    expect(pickup).toMatchObject({ x: 455, y: 400 });
  });

  it('reach further with a pickup radius modifier', () => {
    const { simulation, player } = arena();
    player.modifiers = { pickupRadiusMul: 2 };
    const pickup = drop(simulation.state, 'vibes', 400, 400 + 110);

    simulation.step([]);

    expect(pickup.y).toBe(510 - PICKUP_SPEED);
  });

  it('give collected vibes to the player and collected watts to the core', () => {
    const { simulation, player } = arena();
    const { state } = simulation;
    drop(state, 'vibes', 400 + 50, 400);
    drop(state, 'watts', 400, 400 - 50);

    const recorded = stepAndRecord(simulation, 3);

    expect(player.vibes).toBe(3);
    expect(state.stats.vibesCollected).toBe(3);
    expect(state.core.watts).toBe(50 + 3);
    expect(state.pickups).toEqual([]);
    expect(recorded.filter(({ event }) => event.type === 'pickupCollected')).toEqual([
      { tick: 3, event: { type: 'pickupCollected', playerId: 0, kind: 'vibes', amount: 3 } },
      { tick: 3, event: { type: 'pickupCollected', playerId: 0, kind: 'watts', amount: 3 } },
    ]);
  });

  it('go to the nearest standing player', () => {
    const { simulation, player } = arena({
      ...COMBAT_OPTIONS,
      players: [
        { id: 0, classId: 'raver' },
        { id: 1, classId: 'raver' },
      ],
    });
    const other = simulation.state.players[1];
    if (other === undefined) {
      throw new Error('expected two players');
    }
    other.x = 440;
    other.y = 400;
    const pickup = drop(simulation.state, 'vibes', 430, 400 + 40);

    simulation.step([]);
    const towardNearest = pickup.x;
    other.downed = true;
    simulation.step([]);

    expect(towardNearest).toBeGreaterThan(430);
    expect(pickup.x).toBeLessThan(towardNearest);
    expect(player.vibes).toBe(0);
  });

  it('vanish when their time runs out', () => {
    const { simulation } = arena();
    drop(simulation.state, 'vibes', 1000, 800, 3);

    stepAndRecord(simulation, 2);
    const beforeExpiry = simulation.state.pickups.length;
    simulation.step([]);

    expect(beforeExpiry).toBe(1);
    expect(simulation.state.pickups).toEqual([]);
  });
});

describe('pickups in a team', () => {
  const TEAM: SimulationOptions = {
    ...COMBAT_OPTIONS,
    players: [
      { id: 0, classId: 'raver' },
      { id: 1, classId: 'raver' },
      { id: 2, classId: 'raver' },
    ],
  };

  function team(): { simulation: Simulation; players: PlayerState[] } {
    const { simulation } = arena(TEAM);
    const { players } = simulation.state;
    for (const [index, player] of players.entries()) {
      player.x = 400 + index * 400;
      player.y = 400;
      player.prevX = player.x;
      player.prevY = player.y;
    }
    return { simulation, players };
  }

  it('give the same vibes to every standing player, not to one who is downed', () => {
    const { simulation, players } = team();
    const [collector, ally, downed] = players;
    if (collector === undefined || ally === undefined || downed === undefined) {
      throw new Error('expected three players');
    }
    downed.downed = true;
    drop(simulation.state, 'vibes', collector.x + 50, collector.y);

    stepAndRecord(simulation, 3);

    expect(collector.vibes).toBe(3);
    expect(ally.vibes).toBe(3);
    expect(downed.vibes).toBe(0);
  });

  it('count the vibes collected once and leave the watts to the core alone', () => {
    const { simulation, players } = team();
    const [collector] = players;
    if (collector === undefined) {
      throw new Error('expected a player');
    }
    drop(simulation.state, 'vibes', collector.x + 50, collector.y);
    drop(simulation.state, 'watts', collector.x, collector.y - 50);

    stepAndRecord(simulation, 3);

    expect(simulation.state.stats.vibesCollected).toBe(3);
    expect(simulation.state.core.watts).toBe(50 + 3);
    expect(players.map((player) => player.vibes)).toEqual([3, 3, 3]);
  });
});

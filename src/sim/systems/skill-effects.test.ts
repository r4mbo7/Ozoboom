import { describe, expect, it } from 'vitest';
import { EFFECTS_OPTIONS, commandFor, placeEnemy, stepAndRecord } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { EnemyState, PlayerState, SimState } from '../state';

function game(
  classId: string,
  setId = 'fixture-set',
): { simulation: Simulation; state: SimState; player: PlayerState } {
  const simulation = createSimulation({ ...EFFECTS_OPTIONS, setId, players: [{ id: 0, classId }] });
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return { simulation, state: simulation.state, player };
}

function frozen(enemy: EnemyState): EnemyState {
  enemy.stunTicks = 100_000;
  return enemy;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
}

describe('laser show', () => {
  function castOnDrop(): { simulation: Simulation; state: SimState; player: PlayerState } {
    const started = game('raver', 'fast-drop');
    stepAndRecord(started.simulation, 95);
    return started;
  }

  it('hurts every tick of its duration the enemies around the caster', () => {
    const { simulation, state, player } = castOnDrop();
    const inside = frozen(placeEnemy(state, 'curfew', player.x, player.y - 200));
    const outside = frozen(placeEnemy(state, 'curfew', player.x, player.y - 300 - 40 - 1));

    simulation.step([commandFor(0, { ultimate: true })]);
    stepAndRecord(simulation, 94);
    const beforeLastTick = state.laserShows?.length;
    stepAndRecord(simulation, 1);
    const afterLastTick = state.laserShows?.length;
    stepAndRecord(simulation, 10);

    expect([beforeLastTick, afterLastTick]).toEqual([1, 0]);
    expect([inside.hp, outside.hp]).toEqual([500 - 2 * 96, 500]);
  });

  it('follows its caster', () => {
    const { simulation, state, player } = castOnDrop();
    const left = frozen(placeEnemy(state, 'curfew', player.x, player.y - 200));

    simulation.step([commandFor(0, { ultimate: true })]);
    player.x = left.x + 1000;
    player.prevX = player.x;
    stepAndRecord(simulation, 10);

    expect(left.hp).toBe(500 - 2);
  });
});

describe('barrier', () => {
  function raised(): { simulation: Simulation; state: SimState; player: PlayerState } {
    const started = game('roadie');
    started.simulation.step([commandFor(0, { skill: true })]);
    return started;
  }

  it('pushes the enemies inside it out to its edge', () => {
    const { simulation, state, player } = game('roadie');
    const caught = placeEnemy(state, 'grump', player.x, player.y - 50);

    simulation.step([commandFor(0, { skill: true })]);

    expect(distance(caught, player)).toBeCloseTo(100 + 12, 9);
    expect(caught.x).toBeCloseTo(player.x, 9);
  });

  it('takes the damage of every enemy pressing on it on each beat', () => {
    const { simulation, state } = raised();
    const barrier = state.barriers?.[0];
    if (barrier === undefined) {
      throw new Error('expected a barrier');
    }
    const pressing = [placeEnemy(state, 'grump', 0, 0), placeEnemy(state, 'grump', 0, 0)];
    const pressAt = () => {
      for (const enemy of pressing) {
        enemy.x = barrier.x + 50;
        enemy.y = barrier.y;
        enemy.prevX = enemy.x;
        enemy.prevY = enemy.y;
      }
    };
    stepAndRecord(simulation, 9);

    pressAt();
    simulation.step([]);
    const offBeat = barrier.hp;
    pressAt();
    simulation.step([]);

    expect(state.tick).toBe(12);
    expect(offBeat).toBe(60);
    expect(barrier.hp).toBe(60 - 2 * 5);
  });

  it('falls when its duration ends', () => {
    const { simulation, state } = raised();

    stepAndRecord(simulation, 94);
    const onLastTick = state.barriers?.length;
    simulation.step([]);

    expect(state.tick).toBe(96);
    expect([onLastTick, state.barriers?.length]).toEqual([1, 0]);
  });

  it('breaks when its hp runs out', () => {
    const { simulation, state } = raised();
    const barrier = state.barriers?.[0];
    if (barrier === undefined) {
      throw new Error('expected a barrier');
    }
    barrier.hp = 5;
    stepAndRecord(simulation, 10);
    placeEnemy(state, 'grump', barrier.x, barrier.y + 10);

    simulation.step([]);

    expect(state.tick).toBe(12);
    expect(state.barriers).toEqual([]);
  });
});

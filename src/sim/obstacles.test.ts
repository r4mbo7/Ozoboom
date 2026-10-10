import { describe, expect, it } from 'vitest';
import type { ObstacleDefinition } from '../data/types';
import { COMBAT_OPTIONS, FIXTURE_SET, commandFor, placeEnemy } from './fixtures';
import { createSimulation, type Simulation } from './index';
import type { PlayerState } from './state';

function withObstacles(obstacles: readonly ObstacleDefinition[]): Simulation {
  return createSimulation({
    ...COMBAT_OPTIONS,
    content: {
      ...COMBAT_OPTIONS.content,
      sets: [{ ...FIXTURE_SET, obstacles }],
    },
  });
}

function onlyPlayer(simulation: Simulation): PlayerState {
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return player;
}

function walkUp(simulation: Simulation, player: PlayerState, ticks: number): void {
  player.x = 800;
  player.y = 600;
  for (let i = 0; i < ticks; i++) {
    simulation.step([commandFor(0, { move: { x: 0, y: -1 } })]);
  }
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

describe('obstacles', () => {
  it('stop a player walking into a pole', () => {
    const pole = { x: 800, y: 400, radius: 30 };
    const simulation = withObstacles([pole]);
    const player = onlyPlayer(simulation);

    walkUp(simulation, player, 100);

    expect(distance(player, pole)).toBeGreaterThanOrEqual(pole.radius + player.radius - 1e-9);
    expect(player.y).toBeGreaterThan(pole.y);
  });

  it('let a player through poles wider apart than its diameter', () => {
    const simulation = withObstacles([]);
    const radius = onlyPlayer(simulation).radius;
    const gap = 2 * radius + 20;
    const passing = withObstacles([
      { x: 800 - gap / 2 - 30, y: 400, radius: 30 },
      { x: 800 + gap / 2 + 30, y: 400, radius: 30 },
    ]);
    const player = onlyPlayer(passing);

    walkUp(passing, player, 100);

    expect(player.y).toBeLessThan(400);
  });

  it('hold a bad vibe wider than the gap', () => {
    const probe = withObstacles([]);
    const { core } = probe.state;
    const radius = placeEnemy(probe.state, 'grump', 0, 0).radius;
    const gap = radius * 2 - 4;
    const wall: ObstacleDefinition[] = [];
    for (let x = 30; x < 1600; x += 60) {
      if (Math.abs(x - core.x) > gap / 2 + 30) {
        wall.push({ x, y: core.y - 150, radius: 30 });
      }
    }
    wall.push(
      { x: core.x - gap / 2 - 30, y: core.y - 150, radius: 30 },
      { x: core.x + gap / 2 + 30, y: core.y - 150, radius: 30 },
    );
    const blocked = withObstacles(wall);
    const stuck = placeEnemy(blocked.state, 'grump', core.x, core.y - 300);

    for (let i = 0; i < 200; i++) {
      blocked.step([]);
    }

    expect(stuck.y).toBeLessThan(core.y - 150);
  });

  it('stop a shot on a pole', () => {
    const simulation = withObstacles([{ x: 500, y: 300, radius: 30 }]);
    const { state } = simulation;
    state.projectiles.push({
      id: state.nextEntityId,
      owner: { kind: 'player', playerId: 0 },
      x: 400,
      y: 300,
      prevX: 400,
      prevY: 300,
      vx: 10,
      vy: 0,
      radius: 4,
      damage: 10,
      ticksLeft: 100,
      pierceLeft: 0,
    });

    for (let i = 0; i < 20; i++) {
      simulation.step([]);
    }

    expect(state.projectiles).toEqual([]);
  });
});

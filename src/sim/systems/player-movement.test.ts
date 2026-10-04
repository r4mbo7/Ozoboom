import { describe, expect, it } from 'vitest';
import { length, sub } from '../../shared/vec';
import type { PlayerInput } from '../commands';
import { FIXTURE_OPTIONS, commandFor } from '../fixtures';
import { createSimulation, type Simulation } from '../index';
import type { PlayerState } from '../state';

function soloGame(): { simulation: Simulation; player: PlayerState } {
  const simulation = createSimulation(FIXTURE_OPTIONS);
  const player = simulation.state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return { simulation, player };
}

function hold(simulation: Simulation, input: Partial<PlayerInput>, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    simulation.step([commandFor(0, input)]);
  }
}

describe('player movement', () => {
  it('moves the player by its speed each tick in the direction of the input', () => {
    const { simulation, player } = soloGame();
    const start = { x: player.x, y: player.y };

    hold(simulation, { move: { x: 0, y: -1 } }, 10);

    expect({ x: player.x, y: player.y }).toEqual({ x: start.x, y: start.y - 40 });
  });

  it('moves at the same speed diagonally and whatever the strength of the input', () => {
    const { simulation, player } = soloGame();
    const start = { x: player.x, y: player.y };

    hold(simulation, { move: { x: 1, y: 1 } }, 1);
    const diagonalStep = length(sub(player, start));
    const beforeStrongPush = player.x;
    hold(simulation, { move: { x: 25, y: 0 } }, 1);

    expect(diagonalStep).toBeCloseTo(player.speed, 12);
    expect(player.x - beforeStrongPush).toBe(player.speed);
  });

  it('keeps the player inside the arena on every side', () => {
    const { simulation, player } = soloGame();
    const { width, height } = simulation.state.arena;

    hold(simulation, { move: { x: -1, y: -1 } }, 1000);
    const topLeft = { x: player.x, y: player.y };
    hold(simulation, { move: { x: 1, y: 1 } }, 1000);
    const bottomRight = { x: player.x, y: player.y };

    expect(topLeft).toEqual({ x: player.radius, y: player.radius });
    expect(bottomRight).toEqual({ x: width - player.radius, y: height - player.radius });
  });

  it('aims along the normalized aim input', () => {
    const { simulation, player } = soloGame();

    hold(simulation, { aim: { x: 0, y: -30 } }, 1);

    expect(player.aim).toEqual({ x: 0, y: -1 });
  });

  it('keeps the previous aim when the aim input is zero', () => {
    const { simulation, player } = soloGame();
    hold(simulation, { aim: { x: 0, y: 2 } }, 1);

    hold(simulation, { aim: { x: 0, y: 0 } }, 1);

    expect(player.aim).toEqual({ x: 0, y: 1 });
  });

  it('gives an idle input to a player without a command', () => {
    const { simulation, player } = soloGame();
    hold(simulation, { aim: { x: 0, y: 1 } }, 1);
    const position = { x: player.x, y: player.y };

    simulation.step([]);

    expect({ x: player.x, y: player.y }).toEqual(position);
    expect(player.aim).toEqual({ x: 1, y: 0 });
  });

  it('neither moves nor turns a downed player while the others keep playing', () => {
    const simulation = createSimulation({
      ...FIXTURE_OPTIONS,
      players: [
        { id: 0, classId: 'raver' },
        { id: 1, classId: 'raver' },
      ],
    });
    const [downed, standing] = simulation.state.players;
    if (downed === undefined || standing === undefined) {
      throw new Error('expected two players');
    }
    downed.downed = true;
    const downedAt = { x: downed.x, y: downed.y, aim: downed.aim };
    const standingX = standing.x;

    simulation.step([
      commandFor(0, { move: { x: 1, y: 0 }, aim: { x: 0, y: 1 } }),
      commandFor(1, { move: { x: 1, y: 0 } }),
    ]);

    expect({ x: downed.x, y: downed.y, aim: downed.aim }).toEqual(downedAt);
    expect(standing.x).toBe(standingX + standing.speed);
  });
});

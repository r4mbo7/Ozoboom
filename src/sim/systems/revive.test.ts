import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR } from '../../shared/tempo';
import {
  FIXTURE_CARER,
  FIXTURE_CONTENT,
  FIXTURE_OPTIONS,
  FIXTURE_SET,
  peaceful,
  stepAndRecord,
} from '../fixtures';
import { createSimulation, type Simulation, type SimulationOptions } from '../index';
import type { PlayerState } from '../state';

const CARER = { ...FIXTURE_CARER, reviveMul: 2 };

const teamOptions = (reviveBars: number): SimulationOptions => ({
  ...FIXTURE_OPTIONS,
  players: [
    { id: 0, classId: 'raver' },
    { id: 1, classId: 'carer' },
    { id: 2, classId: 'raver' },
  ],
  content: {
    ...FIXTURE_CONTENT,
    classes: [...FIXTURE_CONTENT.classes, CARER],
    sets: [{ ...FIXTURE_SET, reviveBars }],
  },
});

function team(reviveBars = 1): {
  simulation: Simulation;
  downed: PlayerState;
  raver: PlayerState;
  carer: PlayerState;
} {
  const simulation = peaceful(createSimulation(teamOptions(reviveBars)));
  const [downed, carer, raver] = simulation.state.players;
  if (downed === undefined || carer === undefined || raver === undefined) {
    throw new Error('expected three players');
  }
  for (const [index, player] of [downed, carer, raver].entries()) {
    player.x = 200 + index * 600;
    player.y = 400;
    player.prevX = player.x;
    player.prevY = player.y;
  }
  downed.downed = true;
  downed.hp = 0;
  return { simulation, downed, raver, carer };
}

function moveNextTo(player: PlayerState, to: PlayerState): void {
  player.x = to.x + 10;
  player.y = to.y;
  player.prevX = player.x;
  player.prevY = player.y;
}

function moveAway(player: PlayerState): void {
  player.x = 1500;
  player.y = 800;
  player.prevX = player.x;
  player.prevY = player.y;
}

describe('revive', () => {
  it('raises a downed ally one tick per tick of contact with a standing ally', () => {
    const { simulation, downed, raver } = team();
    moveNextTo(raver, downed);

    stepAndRecord(simulation, 10);

    expect(downed.reviveTicks).toBe(10);
    expect(downed.downed).toBe(true);
  });

  it('reports the progress of the revive on each tick and who is reviving', () => {
    const { simulation, downed, raver } = team();
    moveNextTo(raver, downed);

    simulation.step([]);

    expect(simulation.state.events).toContainEqual({
      type: 'playerReviving',
      playerId: downed.id,
      byPlayer: raver.id,
      progress: 1 / TICKS_PER_BAR,
    });
  });

  it('stands the ally up at half life after reviveBars bars, a target again', () => {
    const { simulation, downed, raver } = team();
    moveNextTo(raver, downed);

    const recorded = stepAndRecord(simulation, TICKS_PER_BAR);

    expect(downed.downed).toBe(false);
    expect(downed.hp).toBe(downed.maxHp / 2);
    expect(downed.invulnerableTicks).toBeGreaterThan(0);
    expect(recorded.map(({ event }) => event.type)).toContain('playerRevived');
  });

  it('revives twice as fast for a class with a reviveMul of 2', () => {
    const { simulation, downed, carer } = team();
    moveNextTo(carer, downed);

    stepAndRecord(simulation, TICKS_PER_BAR / 2 - 1);
    expect(downed.downed).toBe(true);
    simulation.step([]);

    expect(downed.downed).toBe(false);
  });

  it('lets the best reviveMul in contact lead when two allies stand there', () => {
    const { simulation, downed, carer, raver } = team();
    moveNextTo(raver, downed);
    moveNextTo(carer, downed);

    simulation.step([]);

    expect(downed.reviveTicks).toBe(2);
    expect(simulation.state.events).toContainEqual(
      expect.objectContaining({ type: 'playerReviving', byPlayer: carer.id }),
    );
  });

  it('starts over when the contact breaks', () => {
    const { simulation, downed, raver } = team();
    moveNextTo(raver, downed);
    stepAndRecord(simulation, TICKS_PER_BAR - 1);
    const { x, y } = raver;

    moveAway(raver);
    simulation.step([]);
    raver.x = x;
    raver.y = y;
    stepAndRecord(simulation, TICKS_PER_BAR - 1);

    expect(downed.reviveTicks).toBe(TICKS_PER_BAR - 1);
    expect(downed.downed).toBe(true);
  });

  it('does not count a downed ally as a helper', () => {
    const { simulation, downed, raver } = team();
    raver.downed = true;
    moveNextTo(raver, downed);

    simulation.step([]);

    expect(downed.reviveTicks).toBeUndefined();
    expect(downed.downed).toBe(true);
  });

  it('waits for the reviveBars of the set', () => {
    const { simulation, downed, raver } = team(2);
    moveNextTo(raver, downed);

    stepAndRecord(simulation, TICKS_PER_BAR);
    expect(downed.downed).toBe(true);
    stepAndRecord(simulation, TICKS_PER_BAR);

    expect(downed.downed).toBe(false);
  });

  it('leaves a lone downed player alone, and the game lost', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    const [player] = simulation.state.players;
    if (player === undefined) {
      throw new Error('expected one player');
    }
    player.downed = true;

    simulation.step([]);

    expect(player.reviveTicks).toBeUndefined();
    expect(simulation.state.status).toBe('lost');
  });
});

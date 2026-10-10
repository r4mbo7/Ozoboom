import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_PHRASE } from '../../shared/tempo';
import { FIXTURE_OPTIONS, commandFor, peaceful, stepAndRecord } from '../fixtures';
import { createSimulation } from '../index';

const SET_LENGTH = 2 * (TICKS_PER_PHRASE + 3 * TICKS_PER_BAR);

const twoPlayers = {
  ...FIXTURE_OPTIONS,
  players: [
    { id: 0, classId: 'raver' },
    { id: 1, classId: 'raver' },
  ],
} as const;

describe('status', () => {
  it('wins when the last drop of the fixture set ends without enemies', () => {
    const simulation = peaceful(createSimulation(FIXTURE_OPTIONS));

    const recorded = stepAndRecord(simulation, SET_LENGTH);

    expect(simulation.state.status).toBe('won');
    expect(simulation.state.tick).toBe(SET_LENGTH);
    expect(simulation.state.set.tier).toBe(2);
    expect(recorded.filter(({ event }) => event.type === 'gameWon')).toEqual([
      { tick: SET_LENGTH, event: { type: 'gameWon' } },
    ]);
  });

  it('stays running until the last tick of the set', () => {
    const simulation = peaceful(createSimulation(FIXTURE_OPTIONS));

    stepAndRecord(simulation, SET_LENGTH - 1);

    expect(simulation.state.status).toBe('running');
  });

  it('loses as soon as the core has no volume left', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    simulation.state.core.hp = 0;

    simulation.step([]);

    expect(simulation.state.status).toBe('lost');
    expect(simulation.state.events).toEqual([{ type: 'gameLost' }]);
  });

  it('loses when every player is downed, not before', () => {
    const simulation = createSimulation(twoPlayers);
    const [first, second] = simulation.state.players;
    if (first === undefined || second === undefined) {
      throw new Error('expected two players');
    }

    first.downed = true;
    simulation.step([]);
    const withOneStanding = simulation.state.status;
    second.downed = true;
    simulation.step([]);

    expect(withOneStanding).toBe('running');
    expect(simulation.state.status).toBe('lost');
  });

  it('prefers losing to winning when both happen on the same tick', () => {
    const simulation = peaceful(createSimulation(FIXTURE_OPTIONS));
    stepAndRecord(simulation, SET_LENGTH - 1);
    simulation.state.core.hp = 0;

    simulation.step([]);

    expect(simulation.state.status).toBe('lost');
  });

  it('freezes the game once it is over', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    simulation.state.core.hp = 0;
    simulation.step([]);
    const player = simulation.state.players[0];
    const position = { x: player?.x, y: player?.y };

    simulation.step([commandFor(0, { move: { x: 1, y: 0 } })]);

    expect(simulation.state.tick).toBe(1);
    expect(simulation.state.events).toEqual([]);
    expect({ x: player?.x, y: player?.y }).toEqual(position);
  });

  it('pauses the game while an upgrade offer is pending and resumes once it is answered', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    const player = simulation.state.players[0];
    simulation.state.pendingUpgrades.push({
      playerId: 0,
      options: ['quick-feet', 'big-bass'],
      rarities: ['common', 'common'],
    });

    simulation.step([]);
    const statusWhenOffered = simulation.state.status;
    const startX = player?.x;
    stepAndRecord(simulation, 2 * TICKS_PER_BAR);
    simulation.step([commandFor(0, { move: { x: 1, y: 0 } })]);
    const paused = {
      tick: simulation.state.tick,
      x: player?.x,
      events: [...simulation.state.events],
    };
    simulation.state.pendingUpgrades.length = 0;
    simulation.step([]);
    const statusWhenAnswered = simulation.state.status;
    simulation.step([]);

    expect(statusWhenOffered).toBe('choosingUpgrade');
    expect(paused).toEqual({ tick: 1, x: startX, events: [] });
    expect(statusWhenAnswered).toBe('running');
    expect(simulation.state.tick).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import { seedRng } from '../shared/prng';
import { distanceSquared } from '../shared/vec';
import { FIXTURE_OPTIONS, commandFor } from './fixtures';
import { createSimulation } from './index';

describe('createSimulation', () => {
  it('puts the core in the middle of the arena with its full volume and the starting watts', () => {
    const options = FIXTURE_OPTIONS;

    const { state } = createSimulation(options);

    expect(state.arena).toEqual({ width: 1600, height: 900 });
    expect(state.core).toEqual({ x: 800, y: 450, radius: 48, hp: 1000, maxHp: 1000, watts: 50 });
  });

  it('places every player around the core, inside the arena, with the stats of their class', () => {
    const options = {
      ...FIXTURE_OPTIONS,
      players: [
        { id: 0, classId: 'raver' },
        { id: 1, classId: 'raver' },
        { id: 2, classId: 'raver' },
        { id: 3, classId: 'raver' },
      ] as const,
    };

    const { state } = createSimulation(options);

    const positions = state.players.map((player) => `${String(player.x)},${String(player.y)}`);
    expect(new Set(positions).size).toBe(4);
    for (const player of state.players) {
      const clearance = state.core.radius + player.radius;
      expect(distanceSquared(player, state.core)).toBeGreaterThan(clearance * clearance);
      expect(player.x).toBeGreaterThanOrEqual(player.radius);
      expect(player.x).toBeLessThanOrEqual(state.arena.width - player.radius);
      expect(player.y).toBeGreaterThanOrEqual(player.radius);
      expect(player.y).toBeLessThanOrEqual(state.arena.height - player.radius);
      expect(player).toMatchObject({
        classId: 'raver',
        hp: 100,
        maxHp: 100,
        speed: 4,
        radius: 14,
        prevX: player.x,
        prevY: player.y,
        level: 1,
        vibes: 0,
        vibesToNextLevel: 10,
        downed: false,
      });
    }
    expect(state.players.map((player) => player.id)).toEqual([0, 1, 2, 3]);
  });

  it('starts at tick 0 on the first beat of the first buildup, seeded from the seed', () => {
    const options = { ...FIXTURE_OPTIONS, seed: 2026 };

    const { state } = createSimulation(options);

    expect(state.seed).toBe(2026);
    expect(state.tick).toBe(0);
    expect(state.status).toBe('running');
    expect(state.rng).toEqual(seedRng(2026));
    expect(state.set).toEqual({
      tier: 0,
      segment: 'buildup',
      phrase: 0,
      bar: 0,
      beat: 0,
      segmentStartTick: 0,
    });
    expect(state.events).toEqual([
      { type: 'beat', beat: 0 },
      { type: 'bar', bar: 0 },
      { type: 'phrase', phrase: 0 },
      { type: 'segment', segment: 'buildup', tier: 0 },
    ]);
    expect(state.enemies).toEqual([]);
    expect(state.pendingUpgrades).toEqual([]);
  });

  it('rejects an unknown set, an unknown class and a wrong player list', () => {
    expect(() => createSimulation({ ...FIXTURE_OPTIONS, setId: 'nope' })).toThrow(
      'unknown set: "nope"',
    );
    expect(() =>
      createSimulation({ ...FIXTURE_OPTIONS, players: [{ id: 0, classId: 'bard' }] }),
    ).toThrow('unknown class: "bard"');
    expect(() => createSimulation({ ...FIXTURE_OPTIONS, players: [] })).toThrow(RangeError);
    expect(() =>
      createSimulation({
        ...FIXTURE_OPTIONS,
        players: [
          { id: 1, classId: 'raver' },
          { id: 1, classId: 'raver' },
        ],
      }),
    ).toThrow('player ids must be unique');
  });
});

describe('step', () => {
  it('advances one tick, clears the previous events and remembers the previous positions', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    const player = simulation.state.players[0];
    const startX = player?.x;

    simulation.step([commandFor(0, { move: { x: 1, y: 0 } })]);

    expect(simulation.state.tick).toBe(1);
    expect(simulation.state.events).toEqual([]);
    expect(player?.prevX).toBe(startX);

    simulation.step([commandFor(0, { move: { x: 1, y: 0 } })]);

    expect(simulation.state.tick).toBe(2);
    expect(player?.prevX).toBe((startX ?? 0) + 4);
  });

  it('rejects a command for a player who is not in the game', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);

    expect(() => {
      simulation.step([commandFor(2)]);
    }).toThrow('command for unknown player 2');
  });

  it('rejects two commands for the same player in one step', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);

    expect(() => {
      simulation.step([commandFor(0), commandFor(0)]);
    }).toThrow('two commands for player 0 in one step');
  });
});

import { describe, expect, it } from 'vitest';
import type { SetDefinition } from '../../data/types';
import { TICKS_PER_BAR, TICKS_PER_PHRASE } from '../../shared/tempo';
import {
  FIXTURE_CONTENT,
  FIXTURE_OPTIONS,
  FIXTURE_SET,
  peaceful,
  placeEnemy,
  stepAndRecord,
  type TimedEvent,
} from '../fixtures';
import { createSimulation, type Simulation, type SimulationOptions } from '../index';

const BUILDUP = TICKS_PER_PHRASE;
const BREAK = 2 * TICKS_PER_BAR;

const WAVES: SetDefinition = {
  ...FIXTURE_SET,
  tiers: [
    {
      buildupPhrases: 3,
      breakBars: 2,
      bossId: 'curfew',
      spawns: [
        { enemyId: 'grump', everyBars: 1, count: 1, fromPhrase: 0, toPhrase: 0 },
        { enemyId: 'grump', everyBars: 4, count: 3, fromPhrase: 1 },
        { enemyId: 'curfew', everyBars: 8, count: 2, fromPhrase: 2, toPhrase: 2 },
      ],
    },
    {
      buildupPhrases: 1,
      breakBars: 2,
      bossId: 'curfew',
      spawns: [{ enemyId: 'grump', everyBars: 2, count: 1, fromPhrase: 0 }],
    },
  ],
};

const WAVES_OPTIONS: SimulationOptions = {
  ...FIXTURE_OPTIONS,
  content: { ...FIXTURE_CONTENT, sets: [WAVES] },
};

function spawnsByTick(recorded: readonly TimedEvent[]): Map<number, string[]> {
  const byTick = new Map<number, string[]>();
  for (const { tick, event } of recorded) {
    if (event.type === 'enemySpawned') {
      byTick.set(tick, [...(byTick.get(tick) ?? []), event.kind]);
    }
  }
  return byTick;
}

describe('spawning', () => {
  it('spawns the enemies of each rule on the bars of the buildup that fall in its phrases', () => {
    const simulation = peaceful(createSimulation(WAVES_OPTIONS));

    const recorded = stepAndRecord(simulation, 3 * TICKS_PER_PHRASE - 1);

    const expected = new Map<number, string[]>();
    for (let bar = 1; bar < 48; bar++) {
      const phrase = Math.floor(bar / 16);
      const kinds = [
        ...(phrase === 0 ? ['grump'] : []),
        ...(phrase >= 1 && bar % 4 === 0 ? ['grump', 'grump', 'grump'] : []),
        ...(phrase === 2 && bar % 8 === 0 ? ['curfew', 'curfew'] : []),
      ];
      if (kinds.length > 0) {
        expected.set(bar * TICKS_PER_BAR, kinds);
      }
    }
    expect(spawnsByTick(recorded)).toEqual(expected);
  });

  it('counts the bars and phrases of a rule from the start of the buildup of its tier', () => {
    const simulation = peaceful(createSimulation(WAVES_OPTIONS));
    const secondBuildup = 3 * TICKS_PER_PHRASE + BREAK + TICKS_PER_BAR;
    stepAndRecord(simulation, secondBuildup - 1);

    const recorded = stepAndRecord(simulation, TICKS_PER_PHRASE);

    const ticks = [...spawnsByTick(recorded).keys()];
    expect(simulation.state.set.segmentStartTick).toBe(secondBuildup);
    expect(ticks).toEqual(
      Array.from({ length: 8 }, (_, i) => secondBuildup + 2 * i * TICKS_PER_BAR),
    );
  });

  it('spawns nothing on the tick 0, which no step simulates', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);

    const recorded = stepAndRecord(simulation, TICKS_PER_BAR - 1);

    expect(simulation.state.enemies).toEqual([]);
    expect(recorded.filter(({ event }) => event.type === 'enemySpawned')).toEqual([]);
  });

  it('spawns on the edge of the arena, at positions drawn from the seed', () => {
    const run = (seed: number) =>
      stepAndRecord(createSimulation({ ...FIXTURE_OPTIONS, seed }), 3 * TICKS_PER_BAR).flatMap(
        ({ event }) => (event.type === 'enemySpawned' ? [{ x: event.x, y: event.y }] : []),
      );

    const first = run(7);
    const again = run(7);
    const other = run(8);

    expect(first).toHaveLength(6);
    expect(again).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it('places each spawn inside the arena, touching one of its edges', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    const { width, height } = simulation.state.arena;

    const recorded = stepAndRecord(simulation, 8 * TICKS_PER_BAR);

    const spawns = recorded.flatMap(({ event }) => (event.type === 'enemySpawned' ? [event] : []));
    expect(spawns).toHaveLength(16);
    const radius = 12;
    for (const { x, y } of spawns) {
      const onEdge = x === radius || y === radius || x === width - radius || y === height - radius;
      expect(onEdge).toBe(true);
      expect(x).toBeGreaterThanOrEqual(radius);
      expect(x).toBeLessThanOrEqual(width - radius);
      expect(y).toBeGreaterThanOrEqual(radius);
      expect(y).toBeLessThanOrEqual(height - radius);
    }
  });

  it('compounds the hp and speed factors once per phrase since the start of the set', () => {
    const simulation = peaceful(createSimulation(FIXTURE_OPTIONS));
    stepAndRecord(simulation, 2 * TICKS_PER_PHRASE);

    const enemy = placeEnemy(simulation.state, 'grump', 100, 100);

    expect(simulation.state.set.phrase).toBe(2);
    expect(enemy).toMatchObject({
      hp: 20 * 1.1 * 1.1,
      maxHp: 20 * 1.1 * 1.1,
      speed: 2.5 * 1.02 * 1.02,
      damage: 5,
      target: 'core',
      isBoss: false,
    });
  });

  it('lands the boss of the tier on the exact tick of the drop', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    stepAndRecord(peaceful(simulation), BUILDUP + BREAK - 1);

    simulation.step([]);

    const { state } = simulation;
    const spawned = state.events.filter((event) => event.type === 'enemySpawned');
    expect(state.tick).toBe(BUILDUP + BREAK);
    expect(state.set.segment).toBe('drop');
    expect(spawned).toHaveLength(1);
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0]).toMatchObject({ kind: 'curfew', isBoss: true, maxHp: 500 * 1.2 });
  });
});

describe('spawning during the drop', () => {
  const ESCORTED: SetDefinition = {
    ...FIXTURE_SET,
    tiers: [
      {
        buildupPhrases: 1,
        breakBars: 2,
        bossId: 'curfew',
        spawns: [],
        dropSpawns: [{ enemyId: 'grump', everyBars: 2, count: 3, fromPhrase: 0 }],
      },
    ],
  };
  const escorted = (): Simulation =>
    createSimulation({ ...FIXTURE_OPTIONS, content: { ...FIXTURE_CONTENT, sets: [ESCORTED] } });

  it('spawns nothing during the break, even with an escort', () => {
    const simulation = escorted();
    stepAndRecord(simulation, BUILDUP);

    const recorded = stepAndRecord(simulation, BREAK - 1);

    expect(simulation.state.set.segment).toBe('break');
    expect(spawnsByTick(recorded)).toEqual(new Map());
  });

  it('spawns the escort of the tier with its boss, on the bars of the drop', () => {
    const simulation = escorted();
    stepAndRecord(simulation, BUILDUP + BREAK - 1);

    const recorded = stepAndRecord(simulation, 4 * TICKS_PER_BAR + 1);

    const drop = BUILDUP + BREAK;
    expect(simulation.state.set.segment).toBe('drop');
    expect(spawnsByTick(recorded)).toEqual(
      new Map([
        [drop, ['curfew', 'grump', 'grump', 'grump']],
        [drop + 2 * TICKS_PER_BAR, ['grump', 'grump', 'grump']],
        [drop + 4 * TICKS_PER_BAR, ['grump', 'grump', 'grump']],
      ]),
    );
  });

  it('keeps the boss alone on the drop of a tier without an escort', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    stepAndRecord(peaceful(simulation), BUILDUP + BREAK - 1);

    const recorded = stepAndRecord(simulation, 4 * TICKS_PER_BAR + 1);

    expect(simulation.state.set.segment).toBe('drop');
    expect(spawnsByTick(recorded)).toEqual(new Map([[BUILDUP + BREAK, ['curfew']]]));
  });
});

describe('spawning for a team', () => {
  const SCALED: SetDefinition = {
    ...FIXTURE_SET,
    tiers: [
      {
        buildupPhrases: 1,
        breakBars: 2,
        bossId: 'curfew',
        spawns: [{ enemyId: 'grump', everyBars: 4, count: 4, fromPhrase: 0 }],
      },
    ],
    perPlayer: { spawnMul: 0.5, enemyHpMul: 0.25 },
  };
  const playersOf = (count: number): SimulationOptions => ({
    ...FIXTURE_OPTIONS,
    players: ([0, 1, 2, 3] as const).slice(0, count).map((id) => ({ id, classId: 'raver' })),
    content: { ...FIXTURE_CONTENT, sets: [SCALED] },
  });

  it('gives six spawns for a rule of four with two players', () => {
    const simulation = createSimulation(playersOf(2));

    const recorded = stepAndRecord(simulation, 4 * TICKS_PER_BAR);

    expect(spawnsByTick(recorded).get(4 * TICKS_PER_BAR)).toHaveLength(6);
  });

  it('keeps the count of the rule for one player', () => {
    const simulation = createSimulation(playersOf(1));

    const recorded = stepAndRecord(simulation, 4 * TICKS_PER_BAR);

    expect(spawnsByTick(recorded).get(4 * TICKS_PER_BAR)).toHaveLength(4);
  });

  it('gives a bad vibe a quarter more hp with two players', () => {
    const solo = createSimulation(playersOf(1));
    const duo = createSimulation(playersOf(2));
    stepAndRecord(solo, 4 * TICKS_PER_BAR);
    stepAndRecord(duo, 4 * TICKS_PER_BAR);

    expect(solo.state.enemies[0]?.maxHp).toBe(20);
    expect(duo.state.enemies[0]?.maxHp).toBe(20 * 1.25);
    expect(duo.state.enemies[0]?.hp).toBe(20 * 1.25);
  });

  it('scales the boss of the drop too', () => {
    const solo = createSimulation(playersOf(1));
    const trio = createSimulation(playersOf(3));
    for (const simulation of [solo, trio]) {
      stepAndRecord(peaceful(simulation), BUILDUP + BREAK - 1);
      simulation.step([]);
    }

    const bossOf = (simulation: Simulation) =>
      simulation.state.enemies.find((enemy) => enemy.isBoss);
    expect(bossOf(solo)?.maxHp).toBe(500 * 1.2);
    expect(bossOf(trio)?.maxHp).toBe(500 * 1.2 * 1.5);
  });
});

describe('sided waves', () => {
  const withSides = (
    sidedWaves: NonNullable<SetDefinition['sidedWaves']>,
    spawns = FIXTURE_SET.tiers[0]?.spawns ?? [],
  ): SimulationOptions => ({
    ...FIXTURE_OPTIONS,
    content: {
      ...FIXTURE_CONTENT,
      sets: [
        {
          ...FIXTURE_SET,
          sidedWaves,
          tiers: [{ buildupPhrases: 1, breakBars: 2, bossId: 'curfew', spawns }],
        },
      ],
    },
  });
  const spawnsOf = (recorded: readonly TimedEvent[]) =>
    recorded.flatMap(({ event }) => (event.type === 'enemySpawned' ? [event] : []));

  it('keeps the spawns of a set without sided waves where they were', () => {
    const simulation = createSimulation({ ...FIXTURE_OPTIONS, seed: 7 });

    const recorded = stepAndRecord(simulation, 2 * TICKS_PER_BAR);

    expect(spawnsOf(recorded).map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 1588, y: 534.6028964277357 },
      { x: 1588, y: 833.5138090103865 },
      { x: 1521.1259090844542, y: 12 },
      { x: 1588, y: 793.435795051977 },
    ]);
    expect(simulation.state.spawnWindow).toBeUndefined();
  });

  it('sends about four bad vibes in five from the side of a one-sided window', () => {
    const simulation = peaceful(
      createSimulation(
        withSides({ everyBars: 8, chance: 1, randomShare: 0.2 }, [
          { enemyId: 'grump', everyBars: 1, count: 60, fromPhrase: 0 },
        ]),
      ),
    );
    simulation.state.spawnWindow = { index: 0, sides: ['left'] };

    const spawns = spawnsOf(stepAndRecord(simulation, 7 * TICKS_PER_BAR));

    const radius = 12;
    const onLeft = spawns.filter(({ x }) => x === radius).length;
    expect(spawns).toHaveLength(420);
    expect(onLeft / spawns.length).toBeGreaterThan(0.78);
    expect(onLeft / spawns.length).toBeLessThan(0.9);
    expect(spawns.length - onLeft).toBeGreaterThan(40);
  });

  it('draws one or two distinct sides for some windows, from the seed', () => {
    const windows = (seed: number) => {
      const simulation = peaceful(
        createSimulation({ ...withSides({ everyBars: 2, chance: 0.5, randomShare: 0.2 }), seed }),
      );
      const seen: { index: number; sides: string[] }[] = [];
      for (let window = 0; window < 7; window++) {
        stepAndRecord(simulation, 2 * TICKS_PER_BAR);
        const current = simulation.state.spawnWindow;
        seen.push({ index: current?.index ?? -1, sides: [...(current?.sides ?? [])] });
      }
      return seen;
    };

    const first = windows(7);

    expect(windows(7)).toEqual(first);
    expect(windows(8)).not.toEqual(first);
    expect(first.map(({ index }) => index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(first.some(({ sides }) => sides.length === 0)).toBe(true);
    expect(first.some(({ sides }) => sides.length > 0)).toBe(true);
    for (const { sides } of first) {
      expect(sides.length).toBeLessThanOrEqual(2);
      expect(new Set(sides).size).toBe(sides.length);
    }
  });
});

describe('spawning with obstacles', () => {
  const OBSTACLES = [
    { x: 800, y: 150, radius: 150 },
    { x: 150, y: 450, radius: 150 },
    { x: 1450, y: 450, radius: 150 },
    { x: 800, y: 750, radius: 150 },
  ];
  const options: SimulationOptions = {
    ...FIXTURE_OPTIONS,
    content: { ...FIXTURE_CONTENT, sets: [{ ...WAVES, obstacles: OBSTACLES }] },
  };

  it('keeps every spawn out of the obstacles', () => {
    const simulation = peaceful(createSimulation(options));

    const recorded = stepAndRecord(simulation, 3 * TICKS_PER_PHRASE - 1);

    const spawns = recorded.flatMap(({ event }) => (event.type === 'enemySpawned' ? [event] : []));
    expect(spawns.length).toBeGreaterThan(30);
    for (const spawn of spawns) {
      for (const obstacle of OBSTACLES) {
        const gap =
          Math.sqrt(
            (spawn.x - obstacle.x) * (spawn.x - obstacle.x) +
              (spawn.y - obstacle.y) * (spawn.y - obstacle.y),
          ) - obstacle.radius;
        expect(gap).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it('places the same spawns for the same seed', () => {
    const run = () =>
      stepAndRecord(peaceful(createSimulation(options)), TICKS_PER_PHRASE).filter(
        ({ event }) => event.type === 'enemySpawned',
      );

    expect(run()).toEqual(run());
  });
});

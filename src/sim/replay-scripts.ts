import type { GameContent, UpgradeDefinition } from '../data/types';
import type { PlayerAction, PlayerCommand } from './commands';
import {
  EFFECTS_CONTENT,
  FIXTURE_CONTENT,
  FIXTURE_OPTIONS,
  FIXTURE_SET,
  commandFor,
  stepAndRecord,
} from './fixtures';
import { createSimulation, type Simulation, type SimulationOptions } from './index';
import { hashState, runScript } from './replay';
import type { EnemyState, SimState, Vec2 } from './state';
import { thrownWeapon } from './weapons/thrown.test-support';

// The scripted games whose final fingerprint is fixed. Vitest pins them in Node and
// `dev/replay.html` replays them in each browser (e2e/determinism.spec.ts): same hash everywhere.
export interface ReplayScript {
  readonly id: string;
  readonly hash: string;
  readonly run: () => SimState;
}

const DIRECTIONS: readonly Vec2[] = [
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
];

const TRAP_TICKS: readonly number[] = [30, 900];
const PLACE_SUBWOOFER: PlayerAction = {
  type: 'placeTrap',
  trapId: 'subwoofer',
  x: 400,
  y: 300,
  dx: 1,
  dy: 0,
};

// The script cannot see the offers, so it names one upgrade per tick: the first one offered wins.
const UPGRADES: readonly string[] = ['quick-feet', 'big-bass', 'wide-nova'];
const choose = (tick: number): PlayerAction => ({
  type: 'chooseUpgrade',
  upgradeId: UPGRADES[tick % UPGRADES.length] ?? 'quick-feet',
});

export const DUO: SimulationOptions = {
  ...FIXTURE_OPTIONS,
  seed: 1234,
  players: [
    { id: 0, classId: 'raver' },
    { id: 1, classId: 'raver' },
  ],
};

export function referenceCommands(ticks: number): PlayerCommand[][] {
  return Array.from({ length: ticks }, (_, tick) => {
    const move = DIRECTIONS[Math.floor(tick / 29) % DIRECTIONS.length] ?? { x: 0, y: 0 };
    const aim = DIRECTIONS[tick % DIRECTIONS.length] ?? { x: 0, y: 0 };
    const commands: PlayerCommand[] = [
      {
        ...commandFor(0, {
          move,
          aim: { x: aim.x * 3, y: aim.y * 3 },
          skill: tick % 7 === 0,
          fire: true,
        }),
        actions: TRAP_TICKS.includes(tick) ? [PLACE_SUBWOOFER, choose(tick)] : [choose(tick)],
      },
    ];
    if (tick % 3 !== 0) {
      commands.push({
        ...commandFor(1, { move: { x: -move.y, y: move.x * 0.5 }, fire: tick % 2 === 0 }),
        actions: [choose(tick)],
      });
    }
    return commands;
  });
}

export const SPEAKER_GAME: SimulationOptions = {
  ...FIXTURE_OPTIONS,
  seed: 77,
  content: {
    ...EFFECTS_CONTENT,
    sets: [
      {
        ...FIXTURE_SET,
        speakers: [
          {
            id: 'dome',
            name: 'Dôme',
            description: 'Une brume.',
            x: 800,
            y: 450,
            radius: 150,
            plugBars: 2,
            aura: { kind: 'mist', slowFactor: 0.5, healPerBar: 10, radius: 100 },
          },
        ],
      },
    ],
  },
};

export function speakerCommands(): PlayerCommand[][] {
  return Array.from({ length: 1000 }, () => [commandFor(0, { fire: true })]);
}

export const RELIC_IDS = ['encore', 'headliner', 'afterparty'];

const RELIC_GAME: SimulationOptions = {
  ...FIXTURE_OPTIONS,
  seed: 4321,
  setId: 'fast-drop',
  content: {
    ...EFFECTS_CONTENT,
    upgrades: [
      ...EFFECTS_CONTENT.upgrades,
      ...RELIC_IDS.map((id): UpgradeDefinition => ({
        id,
        name: id,
        description: id,
        family: 'relic',
        modifiers: [{ stat: 'damageMul', mul: 1.5 }],
        maxStacks: 1,
      })),
    ],
  },
};

// Records the commands of a bot that shoots the nearest enemy until the first boss drops its
// relics, then names one relic per tick: the first one offered wins.
export function relicCommands(): PlayerCommand[][] {
  const simulation = createSimulation(RELIC_GAME);
  const script: PlayerCommand[][] = [];
  for (let tick = 0; tick < 6000; tick += 1) {
    const player = simulation.state.players[0];
    if (player === undefined) {
      throw new Error('expected one player');
    }
    const distance = (enemy: EnemyState): number =>
      Math.sqrt(
        (enemy.x - player.x) * (enemy.x - player.x) + (enemy.y - player.y) * (enemy.y - player.y),
      );
    const [target] = [...simulation.state.enemies].sort((a, b) => distance(a) - distance(b));
    const aim =
      target === undefined ? { x: 1, y: 0 } : { x: target.x - player.x, y: target.y - player.y };
    const length = Math.sqrt(aim.x * aim.x + aim.y * aim.y) || 1;
    const move =
      target !== undefined && length < 250
        ? { x: -aim.x / length, y: -aim.y / length }
        : { x: 0, y: 0 };
    const commands = [commandFor(0, { aim, move, fire: true, skill: tick % 7 === 0 })];
    script.push(commands);
    simulation.step(commands);
    if (simulation.state.pendingUpgrades.some((offer) => offer.kind === 'relic')) {
      break;
    }
  }
  for (const upgradeId of RELIC_IDS) {
    script.push([{ ...commandFor(0), actions: [{ type: 'chooseUpgrade', upgradeId }] }]);
  }
  return script;
}

const THROWN_CONTENT: GameContent = {
  ...FIXTURE_CONTENT,
  weapons: [
    thrownWeapon(
      'spark',
      { kind: 'spark', damage: 5, speed: 18, pierce: 3, rangeTicks: 24 },
      [0, 4, 8, 12],
    ),
    thrownWeapon('lob', { kind: 'lob', damage: 30, radius: 80, range: 260, flightTicks: 24 }, [0]),
    thrownWeapon(
      'frisbee',
      { kind: 'boomerang', damage: 14, heal: 6, range: 280, speed: 16 },
      [4, 12],
    ),
  ],
};

export function playThrown(): {
  simulation: Simulation;
  recorded: ReturnType<typeof stepAndRecord>;
} {
  const simulation = createSimulation({ ...FIXTURE_OPTIONS, seed: 7, content: THROWN_CONTENT });
  const [player] = simulation.state.players;
  if (player === undefined) {
    throw new Error('expected a player');
  }
  player.weapons = ['spark', 'lob', 'frisbee'].map((id) => ({ id, level: 1, phase: 0 }));
  return { simulation, recorded: stepAndRecord(simulation, 900) };
}

// Three players, the first one fragile: the team has someone to stand back up.
export const TRIO: SimulationOptions = (() => {
  const [raver] = FIXTURE_CONTENT.classes;
  if (raver === undefined) {
    throw new Error('expected the raver class');
  }
  return {
    ...FIXTURE_OPTIONS,
    seed: 909,
    players: [
      { id: 0, classId: 'fragile', name: 'Ana' },
      { id: 1, classId: 'sturdy', name: 'Bo' },
      { id: 2, classId: 'sturdy', name: 'Cy' },
    ],
    content: {
      ...FIXTURE_CONTENT,
      classes: [
        ...FIXTURE_CONTENT.classes,
        { ...raver, id: 'fragile', maxHp: 20 },
        { ...raver, id: 'sturdy', maxHp: 400 },
      ],
      sets: [{ ...FIXTURE_SET, reviveBars: 1, perPlayer: { spawnMul: 0.5, enemyHpMul: 0.25 } }],
    },
  };
})();

// Plays the team and counts how often a player went down and was stood back up.
export function playTeam(): { state: SimState; downs: number; revives: number } {
  const simulation = createSimulation(TRIO);
  const [fragile, ...friends] = simulation.state.players;
  if (fragile === undefined) {
    throw new Error('expected a team');
  }
  let downs = 0;
  let revives = 0;
  for (let tick = 0; tick < 2000; tick += 1) {
    const aim = DIRECTIONS[Math.floor(tick / 31) % DIRECTIONS.length] ?? { x: 1, y: 0 };
    const commands: PlayerCommand[] = [
      { ...commandFor(fragile.id, { move: aim, aim, fire: true }), actions: [choose(tick)] },
    ];
    for (const friend of friends) {
      const toward = fragile.downed
        ? { x: fragile.x - friend.x, y: fragile.y - friend.y }
        : { x: 0, y: 0 };
      commands.push({
        ...commandFor(friend.id, { move: toward, aim, fire: true }),
        actions: [choose(tick)],
      });
    }
    simulation.step(commands);
    downs += simulation.state.events.filter((event) => event.type === 'playerDowned').length;
    revives += simulation.state.events.filter((event) => event.type === 'playerRevived').length;
  }
  return { state: simulation.state, downs, revives };
}

export const REPLAY_SCRIPTS: readonly ReplayScript[] = [
  {
    id: 'reference',
    hash: 'ab21c6ee',
    run: () => runScript(DUO, referenceCommands(2000)),
  },
  {
    id: 'speaker',
    hash: '734492fb',
    run: () => runScript(SPEAKER_GAME, speakerCommands()),
  },
  {
    id: 'relic',
    hash: '5afee964',
    run: () => runScript(RELIC_GAME, relicCommands()),
  },
  {
    id: 'thrown',
    hash: '87a3e4c4',
    run: () => playThrown().simulation.state,
  },
  {
    id: 'team',
    hash: '9640018e',
    run: () => playTeam().state,
  },
];

export function replayHashes(): Record<string, string> {
  return Object.fromEntries(REPLAY_SCRIPTS.map((script) => [script.id, hashState(script.run())]));
}

export function replayScript(id: string): ReplayScript {
  const script = REPLAY_SCRIPTS.find((candidate) => candidate.id === id);
  if (script === undefined) {
    throw new Error(`no replay script "${id}"`);
  }
  return script;
}

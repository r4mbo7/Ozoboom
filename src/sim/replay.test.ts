import { describe, expect, it } from 'vitest';
import type { UpgradeDefinition } from '../data/types';
import type { PlayerAction, PlayerCommand } from './commands';
import { EFFECTS_CONTENT, FIXTURE_OPTIONS, FIXTURE_SET, commandFor } from './fixtures';
import { createSimulation, type SimulationOptions } from './index';
import { hashState, runScript } from './replay';
import type { EnemyState, Vec2 } from './state';

const REFERENCE_HASH = '40467116';

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

const duo: SimulationOptions = {
  ...FIXTURE_OPTIONS,
  seed: 1234,
  players: [
    { id: 0, classId: 'raver' },
    { id: 1, classId: 'raver' },
  ],
};

function referenceScript(ticks: number): PlayerCommand[][] {
  return Array.from({ length: ticks }, (_, tick) => {
    const move = DIRECTIONS[Math.floor(tick / 29) % DIRECTIONS.length] ?? { x: 0, y: 0 };
    const aim = DIRECTIONS[tick % DIRECTIONS.length] ?? { x: 0, y: 0 };
    const commands: PlayerCommand[] = [
      {
        ...commandFor(0, {
          move,
          aim: { x: aim.x * 3, y: aim.y * 3 },
          skill: tick % 7 === 0,
          ultimate: tick % 5 === 0,
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

const SPEAKER_HASH = '4b896531';

const speakerGame: SimulationOptions = {
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

describe('replay', () => {
  it('reaches the same state twice from the same seed and script', () => {
    const script = referenceScript(1000);

    const first = hashState(runScript(duo, script));
    const second = hashState(runScript(duo, script));

    expect(first).toBe(second);
  });

  it('reaches another state from another seed', () => {
    const script = referenceScript(1000);

    const original = hashState(runScript(duo, script));
    const reseeded = hashState(runScript({ ...duo, seed: 1235 }, script));

    expect(reseeded).not.toBe(original);
  });

  it('keeps the fingerprint of the reference script', () => {
    const script = referenceScript(2000);

    const state = runScript(duo, script);

    expect(state.status).toBe('running');
    expect(state.set.segment).toBe('drop');
    expect(state.stats.kills).toBe(30);
    expect(state.stats.phrasesHeld).toBe(2);
    expect(state.players.map((player) => player.upgrades)).toEqual([[], ['big-bass']]);
    expect(hashState(state)).toBe(REFERENCE_HASH);
  });
});

describe('replay of a game that plugs a speaker', () => {
  it('keeps the fingerprint of the speaker script', () => {
    const script = Array.from({ length: 1000 }, () => [commandFor(0, { fire: true })]);

    const state = runScript(speakerGame, script);

    expect(state.speakers?.map((speaker) => speaker.plugged)).toEqual([true]);
    expect(state.volume).toBe(1);
    expect(hashState(state)).toBe(SPEAKER_HASH);
  });
});

const RELIC_HASH = '10ae53f5';
const RELIC_IDS = ['encore', 'headliner', 'afterparty'];

const relicGame: SimulationOptions = {
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
function scriptToFirstRelic(): PlayerCommand[][] {
  const simulation = createSimulation(relicGame);
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

describe('replay of a game that kills its first boss and picks a relic', () => {
  it('keeps the fingerprint of the relic script', () => {
    const script = scriptToFirstRelic();

    const state = runScript(relicGame, script);

    expect(state.players[0]?.upgrades.filter((id) => RELIC_IDS.includes(id))).toHaveLength(1);
    expect(state.pendingUpgrades.some((offer) => offer.kind === 'relic')).toBe(false);
    expect(hashState(state)).toBe(RELIC_HASH);
  });
});

describe('hashState', () => {
  it('is an 8-digit hexadecimal fingerprint', () => {
    const state = runScript(duo, []);

    expect(hashState(state)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('does not depend on the order in which keys were written', () => {
    const state = runScript(duo, []);
    const reordered = Object.fromEntries(Object.entries(state).reverse()) as typeof state;

    expect(hashState(reordered)).toBe(hashState(state));
  });

  it('changes when any value of the state changes', () => {
    const state = runScript(duo, []);
    const before = hashState(state);
    const player = state.players[1];
    if (player === undefined) {
      throw new Error('expected two players');
    }

    player.x += 0.5;

    expect(hashState(state)).not.toBe(before);
  });
});

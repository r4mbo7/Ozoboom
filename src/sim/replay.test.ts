import { describe, expect, it } from 'vitest';
import type { PlayerAction, PlayerCommand } from './commands';
import { FIXTURE_OPTIONS, commandFor } from './fixtures';
import type { SimulationOptions } from './index';
import { hashState, runScript } from './replay';
import type { Vec2 } from './state';

const REFERENCE_HASH = 'f5de4f1a';

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
  angle: 0,
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
    expect(state.players.map((player) => player.upgrades)).toEqual([[], ['wide-nova']]);
    expect(hashState(state)).toBe(REFERENCE_HASH);
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

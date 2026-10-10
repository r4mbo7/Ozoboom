import { describe, expect, it } from 'vitest';
import type { GameContent, SetDefinition } from '../../data/types';
import type { PlayerCommand } from '../commands';
import { COMBAT_CONTENT, commandFor } from '../fixtures';
import type { SimulationOptions } from '../index';
import { hashState, runScript } from '../replay';
import type { Vec2 } from '../state';

const REFERENCE_HASH = 'e96ebaed';

const SPECIALS_SET: SetDefinition = {
  id: 'specials-fixture-set',
  name: 'Set de test des spéciaux',
  bpm: 145,
  arena: { width: 1600, height: 900 },
  core: { radius: 48, maxHp: 1000 },
  handSize: 2,
  startingHand: [],
  maxTraps: 6,
  levelCurve: { baseVibes: 10, vibesPerLevel: 5 },
  pickups: { lifetimeTicks: 8 * 48, speed: 12 },
  tiers: [
    {
      buildupPhrases: 2,
      breakBars: 2,
      bossId: 'curfew',
      spawns: [
        { enemyId: 'grump', everyBars: 1, count: 1, fromPhrase: 0, toPhrase: 0 },
        { enemyId: 'grifter', everyBars: 2, count: 1, fromPhrase: 0, toPhrase: 0 },
        { enemyId: 'clinger', everyBars: 2, count: 1, fromPhrase: 0, toPhrase: 0 },
      ],
    },
  ],
};

const SPECIALS_CONTENT: GameContent = { ...COMBAT_CONTENT, sets: [SPECIALS_SET] };

const SPECIALS_OPTIONS: SimulationOptions = {
  seed: 777,
  players: [
    { id: 0, classId: 'raver' },
    { id: 1, classId: 'raver' },
  ],
  setId: SPECIALS_SET.id,
  content: SPECIALS_CONTENT,
};

const DIRECTIONS: readonly Vec2[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

function script(ticks: number): PlayerCommand[][] {
  return Array.from({ length: ticks }, (_, tick) => {
    const move = DIRECTIONS[Math.floor(tick / 23) % DIRECTIONS.length] ?? { x: 0, y: 0 };
    return [
      commandFor(0, { move, aim: move, fire: true }),
      commandFor(1, {
        move: { x: -move.y, y: move.x },
        aim: { x: -move.y, y: move.x },
        fire: true,
      }),
    ];
  });
}

describe('specials replay', () => {
  it('reaches the same state twice for a scripted game with a grifter and a clinger', () => {
    const commands = script(600);

    const first = hashState(runScript(SPECIALS_OPTIONS, commands));
    const second = hashState(runScript(SPECIALS_OPTIONS, commands));

    expect(first).toBe(second);
  });

  it('keeps the fingerprint of the reference script', () => {
    const state = runScript(SPECIALS_OPTIONS, script(600));

    expect(hashState(state)).toBe(REFERENCE_HASH);
  });
});

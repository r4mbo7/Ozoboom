import { describe, expect, it } from 'vitest';
import type { EnemyDefinition, GameContent, SetDefinition } from '../../data/types';
import { TICKS_PER_BAR } from '../../shared/tempo';
import { COMBAT_CONTENT, FIXTURE_SET, commandFor, eventsOf } from '../fixtures';
import type { PlayerCommand } from '../commands';
import { createSimulation, type SimulationOptions } from '../index';
import { hashState } from '../replay';
import type { Vec2 } from '../state';

const REFERENCE_HASH = '0d8cd5f6';

const INTOLERANT: EnemyDefinition = {
  id: 'intolerant',
  name: 'Intolerant',
  behaviour: 'horde',
  maxHp: 30,
  speed: 1,
  radius: 12,
  damage: 0,
  attackCooldownTicks: 24,
  aggroRadius: 0,
  vibesDrop: 1,
  wattsDrop: 0,
  scalingPerPhrase: { hp: 1, speed: 1 },
  special: { kind: 'suppress', radius: 100 },
};

const FILMEUR: EnemyDefinition = {
  id: 'filmeur',
  name: 'Filmeur',
  behaviour: 'shooter',
  maxHp: 24,
  speed: 1.5,
  radius: 11,
  damage: 0,
  attackCooldownTicks: 48,
  aggroRadius: 0,
  vibesDrop: 1,
  wattsDrop: 0,
  scalingPerPhrase: { hp: 1, speed: 1 },
  ranged: { projectileSpeed: 6, projectileRadius: 4, rangeTicks: 40, keepDistance: 150 },
  special: { kind: 'dazzle', radius: 90 },
};

const BAVARD: EnemyDefinition = {
  id: 'bavard',
  name: 'Bavard',
  behaviour: 'shooter',
  maxHp: 24,
  speed: 1.5,
  radius: 11,
  damage: 0,
  attackCooldownTicks: 48,
  aggroRadius: 0,
  vibesDrop: 1,
  wattsDrop: 0,
  scalingPerPhrase: { hp: 1, speed: 1 },
  ranged: { projectileSpeed: 6, projectileRadius: 4, rangeTicks: 40, keepDistance: 150 },
  special: { kind: 'babble', everyBars: 2 },
};

const BAD_VIBES_SET: SetDefinition = {
  ...FIXTURE_SET,
  id: 'bad-vibes-set',
  tiers: [
    {
      buildupPhrases: 2,
      breakBars: 2,
      bossId: 'curfew',
      spawns: [
        { enemyId: 'intolerant', everyBars: 2, count: 1, fromPhrase: 0 },
        { enemyId: 'filmeur', everyBars: 3, count: 1, fromPhrase: 0 },
        { enemyId: 'bavard', everyBars: 4, count: 1, fromPhrase: 0 },
      ],
    },
  ],
};

const BAD_VIBES_CONTENT: GameContent = {
  ...COMBAT_CONTENT,
  enemies: [...COMBAT_CONTENT.enemies, INTOLERANT, FILMEUR, BAVARD],
  sets: [BAD_VIBES_SET],
};

const BAD_VIBES_OPTIONS: SimulationOptions = {
  seed: 42,
  players: [{ id: 0, classId: 'raver' }],
  setId: 'bad-vibes-set',
  content: BAD_VIBES_CONTENT,
};

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

function script(ticks: number): PlayerCommand[][] {
  return Array.from({ length: ticks }, (_, tick) => {
    const move = DIRECTIONS[Math.floor(tick / 17) % DIRECTIONS.length] ?? { x: 0, y: 0 };
    return [{ ...commandFor(0, { move, aim: move, fire: true }), actions: [] }];
  });
}

describe('replay against the suppress, dazzle and babble bad vibes', () => {
  it('fixes the fingerprint of a scripted game and exercises all three specials on the way', () => {
    const simulation = createSimulation(BAD_VIBES_OPTIONS);

    const recorded = script(8 * TICKS_PER_BAR * 2).flatMap((stepCommands) => {
      simulation.step(stepCommands);
      return eventsOf(simulation.state);
    });

    expect(recorded.some(({ event }) => event.type === 'enemyBabbled')).toBe(true);
    expect(hashState(simulation.state)).toBe(REFERENCE_HASH);
  });
});

import { describe, expect, it } from 'vitest';
import type { EnemyDefinition, GameContent, SetDefinition } from '../../data/types';
import { TICKS_PER_BAR } from '../../shared/tempo';
import { FIXTURE_OPTIONS, stepAndRecord } from '../fixtures';
import { createSimulation, type SimulationOptions } from '../index';
import { hashState } from '../replay';

const REFERENCE_HASH = 'b32b19e7';
const SCRIPT_TICKS = 500;

const BOUNCER_SHOVE: EnemyDefinition = {
  id: 'bouncer-shove',
  name: 'test-bouncer',
  behaviour: 'rusher',
  maxHp: 20,
  speed: 2.5,
  radius: 12,
  damage: 5,
  attackCooldownTicks: 24,
  aggroRadius: 400,
  vibesDrop: 1,
  wattsDrop: 0,
  scalingPerPhrase: { hp: 1, speed: 1 },
  special: { kind: 'shove', knockback: 30 },
};

const WHINER_SIGH: EnemyDefinition = {
  id: 'whiner-sigh',
  name: 'test-whiner',
  behaviour: 'shooter',
  maxHp: 24,
  speed: 2,
  radius: 11,
  damage: 5,
  attackCooldownTicks: 36,
  aggroRadius: 400,
  vibesDrop: 2,
  wattsDrop: 1,
  scalingPerPhrase: { hp: 1, speed: 1 },
  ranged: { projectileSpeed: 7, projectileRadius: 6, rangeTicks: 50, keepDistance: 40 },
  special: { kind: 'sigh', slowFactor: 0.5, durationTicks: 20 },
};

const SHOVE_SIGH_SET: SetDefinition = {
  id: 'shove-sigh-set',
  name: 'Set de test',
  bpm: 145,
  arena: { width: 240, height: 240 },
  core: { radius: 20, maxHp: 1000, wattsPerBar: 5 },
  startingWatts: 50,
  maxTraps: 6,
  levelCurve: { baseVibes: 10, vibesPerLevel: 5 },
  pickups: { lifetimeTicks: 8 * TICKS_PER_BAR, speed: 12 },
  tiers: [
    {
      buildupPhrases: 1,
      breakBars: 2,
      bossId: 'bouncer-shove',
      spawns: [
        { enemyId: 'bouncer-shove', everyBars: 1, count: 1, fromPhrase: 0 },
        { enemyId: 'whiner-sigh', everyBars: 1, count: 1, fromPhrase: 0 },
      ],
    },
  ],
};

const SHOVE_SIGH_CONTENT: GameContent = {
  ...FIXTURE_OPTIONS.content,
  enemies: [...FIXTURE_OPTIONS.content.enemies, BOUNCER_SHOVE, WHINER_SIGH],
  sets: [SHOVE_SIGH_SET],
};

const shoveSighOptions: SimulationOptions = {
  ...FIXTURE_OPTIONS,
  seed: 42,
  setId: 'shove-sigh-set',
  content: SHOVE_SIGH_CONTENT,
};

describe('shove and sigh replay', () => {
  it('reaches the same state twice from the same seed, with no player command', () => {
    const first = createSimulation(shoveSighOptions);
    stepAndRecord(first, SCRIPT_TICKS);
    const second = createSimulation(shoveSighOptions);
    stepAndRecord(second, SCRIPT_TICKS);

    expect(hashState(first.state)).toBe(hashState(second.state));
  });

  it('plays out a shove and a sigh on the player, with a fixed fingerprint', () => {
    const simulation = createSimulation(shoveSighOptions);

    const recorded = stepAndRecord(simulation, SCRIPT_TICKS);

    expect(recorded.some(({ event }) => event.type === 'playerShoved')).toBe(true);
    expect(recorded.some(({ event }) => event.type === 'playerHit')).toBe(true);
    expect(hashState(simulation.state)).toBe(REFERENCE_HASH);
  });
});

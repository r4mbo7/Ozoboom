import { describe, expect, it } from 'vitest';
import { UPGRADES } from '../data/upgrades';
import { FIXTURE_OPTIONS, FIXTURE_SET } from './fixtures';
import { createSimulation } from './index';
import type { PlayerState } from './state';
import {
  applyModifiers,
  refreshDerivedStats,
  skillCooldownTicks,
  statValue,
  trapCapacity,
} from './stats';

function freshPlayer(): PlayerState {
  const player = createSimulation(FIXTURE_OPTIONS).state.players[0];
  if (player === undefined) {
    throw new Error('expected one player');
  }
  return player;
}

const RAVER = { maxHp: 100, speed: 4 };

describe('statValue', () => {
  it('returns the base value of a stat without modifier', () => {
    const player = freshPlayer();

    expect(statValue(player, 'damageMul', 10)).toBe(10);
    expect(statValue(player, 'maxHpAdd', 100)).toBe(100);
  });

  it('adds an additive stat and multiplies a multiplicative one', () => {
    const player = freshPlayer();
    player.modifiers = { maxHpAdd: 20, damageMul: 1.5 };

    expect(statValue(player, 'maxHpAdd', 100)).toBe(120);
    expect(statValue(player, 'damageMul', 10)).toBe(15);
  });

  it('ignores every modifier and returns the base value while suppressedTicks is positive', () => {
    const player = freshPlayer();
    player.modifiers = { maxHpAdd: 20, damageMul: 1.5 };
    player.suppressedTicks = 5;

    expect(statValue(player, 'maxHpAdd', 100)).toBe(100);
    expect(statValue(player, 'damageMul', 10)).toBe(10);
  });

  it('applies modifiers again once suppressedTicks reaches zero', () => {
    const player = freshPlayer();
    player.modifiers = { damageMul: 1.5 };
    player.suppressedTicks = 0;

    expect(statValue(player, 'damageMul', 10)).toBe(15);
  });
});

describe('applyModifiers', () => {
  it('sums additive modifiers and compounds multiplicative ones', () => {
    const player = freshPlayer();

    applyModifiers(player, [{ stat: 'maxHpAdd', add: 20 }]);
    applyModifiers(player, [{ stat: 'maxHpAdd', add: 20 }]);
    applyModifiers(player, [{ stat: 'speedMul', mul: 1.5 }]);
    applyModifiers(player, [{ stat: 'speedMul', mul: 2 }]);

    expect(player.modifiers).toEqual({ maxHpAdd: 40, speedMul: 3 });
  });

  it('applies the add of a modifier before its mul', () => {
    const player = freshPlayer();

    applyModifiers(player, [{ stat: 'damageMul', add: 0.5, mul: 2 }]);

    expect(player.modifiers).toEqual({ damageMul: 3 });
  });

  it('applies every modifier of the list', () => {
    const player = freshPlayer();

    applyModifiers(player, [
      { stat: 'trapRadiusMul', mul: 0.5 },
      { stat: 'pierceAdd', add: 1 },
    ]);

    expect(player.modifiers).toEqual({ trapRadiusMul: 0.5, pierceAdd: 1 });
  });
});

describe('refreshDerivedStats', () => {
  it('recomputes max hp and speed and gives the max hp difference to the current hp', () => {
    const player = freshPlayer();
    player.hp = 60;
    player.modifiers = { maxHpAdd: 20, speedMul: 1.5 };

    refreshDerivedStats(player, RAVER);

    expect({ hp: player.hp, maxHp: player.maxHp, speed: player.speed }).toEqual({
      hp: 80,
      maxHp: 120,
      speed: 6,
    });
  });

  it('changes nothing when the modifiers do not touch max hp or speed', () => {
    const player = freshPlayer();
    player.hp = 60;
    player.modifiers = { damageMul: 2 };

    refreshDerivedStats(player, RAVER);

    expect({ hp: player.hp, maxHp: player.maxHp, speed: player.speed }).toEqual({
      hp: 60,
      maxHp: 100,
      speed: 4,
    });
  });
});

describe('skillCooldownTicks', () => {
  it('rounds the shortened cooldown to whole ticks, as the sim arms it', () => {
    const player = freshPlayer();
    const loop = UPGRADES.find((upgrade) => upgrade.id === 'boucle-vj');
    if (loop === undefined) {
      throw new Error('expected the Boucle VJ upgrade');
    }
    applyModifiers(player, loop.modifiers);
    applyModifiers(player, loop.modifiers);

    const ticks = skillCooldownTicks(player, { cooldownTicks: 192 });

    expect(ticks).toBe(123);
  });

  it('keeps the base cooldown without modifier', () => {
    const player = freshPlayer();

    const ticks = skillCooldownTicks(player, { cooldownTicks: 192 });

    expect(ticks).toBe(192);
  });
});

describe('trapCapacity', () => {
  it('adds one slot per Volume level to the set maximum', () => {
    const players = [freshPlayer()];

    const capacities = [0, 1, 2, 4].map((volume) => trapCapacity(FIXTURE_SET, { volume, players }));

    expect(capacities).toEqual([6, 7, 8, 10]);
    expect(trapCapacity(FIXTURE_SET, { players })).toBe(6);
  });

  it('adds the trap slots of every player of the team', () => {
    const first = freshPlayer();
    const second = freshPlayer();
    applyModifiers(first, [{ stat: 'trapSlotsAdd', add: 1 }]);
    applyModifiers(second, [{ stat: 'trapSlotsAdd', add: 2 }]);

    expect(trapCapacity(FIXTURE_SET, { volume: 1, players: [first, second] })).toBe(10);
  });
});

describe('player modifiers', () => {
  it('are read only in stats.ts, so every stat goes through statValue', () => {
    const sources = import.meta.glob<string>('/src/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    });

    const offenders = Object.entries(sources)
      .filter(([path]) => path !== '/src/sim/stats.ts' && !path.endsWith('.test.ts'))
      .filter(([, source]) => /\bmodifiers(\?\.|\.|\[)/.test(source))
      .map(([path]) => path);

    expect(Object.keys(sources)).toContain('/src/sim/stats.ts');
    expect(offenders).toEqual([]);
  });
});

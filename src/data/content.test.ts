import { describe, expect, it } from 'vitest';
import {
  BARS_PER_PHRASE,
  DEFAULT_BPM,
  TICKS_PER_BAR,
  TICKS_PER_PHRASE,
  TICK_RATE_HZ,
} from '../shared/tempo';
import { CONTENT } from './content';
import type { SkillDefinition, TierDefinition } from './types';

const { classes, enemies, traps, upgrades, sets, bystanders = [] } = CONTENT;

const enemyById = new Map(enemies.map((enemy) => [enemy.id, enemy]));
const bystanderById = new Map(bystanders.map((bystander) => [bystander.id, bystander]));
const classIds = new Set(classes.map((definition) => definition.id));

const positive = (value: number) => Number.isFinite(value) && value > 0;
const atLeastOne = (value: number) => Number.isFinite(value) && value >= 1;
const wholePositive = (value: number) => Number.isInteger(value) && value > 0;

function invalid(fields: Record<string, readonly [number, (value: number) => boolean]>): string[] {
  return Object.entries(fields)
    .filter(([, [value, isValid]]) => !isValid(value))
    .map(([name, [value]]) => `${name} = ${String(value)}`);
}

interface Leaf<T = unknown> {
  path: string;
  key: string;
  value: T;
}

function leaves(node: unknown, path = 'CONTENT', key = ''): Leaf[] {
  if (typeof node !== 'object' || node === null) {
    return [{ path, key, value: node }];
  }
  return Object.entries(node).flatMap(([childKey, child]) =>
    leaves(child, `${path}.${childKey}`, childKey),
  );
}

const TEXT_KEYS = new Set(['name', 'role', 'description']);
const allLeaves = leaves(CONTENT);
const allNumbers = allLeaves.filter((leaf): leaf is Leaf<number> => typeof leaf.value === 'number');
const allTexts = allLeaves.filter(
  (leaf): leaf is Leaf<string> => typeof leaf.value === 'string' && TEXT_KEYS.has(leaf.key),
);

function duplicates(ids: readonly string[]): string[] {
  return ids.filter((id, index) => ids.indexOf(id) !== index);
}

function effectFields(effect: object): Record<string, readonly [number, typeof positive]> {
  return Object.fromEntries(
    Object.entries(effect)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
      .map(([name, value]) => [name, [value, positive] as const]),
  );
}

function spawnsInPhrase(tier: TierDefinition, phrase: number): number {
  return tier.spawns
    .filter((rule) => rule.fromPhrase <= phrase && phrase <= (rule.toPhrase ?? Infinity))
    .reduce((total, rule) => total + rule.count * (BARS_PER_PHRASE / rule.everyBars), 0);
}

describe('CONTENT identifiers', () => {
  const collections: [string, string[]][] = [
    ['classes', classes.map((item) => item.id)],
    ['enemies', enemies.map((item) => item.id)],
    ['traps', traps.map((item) => item.id)],
    ['upgrades', upgrades.map((item) => item.id)],
    ['sets', sets.map((item) => item.id)],
    ...classes.map((item): [string, string[]] => [
      `${item.id} skills`,
      [item.skill.id, item.ultimate.id],
    ]),
  ];

  it.each(collections)('are unique among %s', (_, ids) => {
    expect(ids.length).toBeGreaterThan(0);
    expect(duplicates(ids)).toEqual([]);
  });

  it('has no duplicate bystander id', () => {
    expect(duplicates(bystanders.map((item) => item.id))).toEqual([]);
  });
});

describe('CONTENT references', () => {
  it.each(sets.flatMap((set) => set.tiers.map((tier, index) => [set.id, index, tier] as const)))(
    'resolve in set %s tier %i',
    (_, __, tier) => {
      expect(enemyById.get(tier.bossId)?.behaviour).toBe('boss');
      for (const rule of tier.spawns) {
        const enemy = enemyById.get(rule.enemyId);
        expect(enemy, rule.enemyId).toBeDefined();
        expect(enemy?.behaviour, rule.enemyId).not.toBe('boss');
      }
      for (const rule of tier.bystanderSpawns ?? []) {
        expect(bystanderById.get(rule.bystanderId), rule.bystanderId).toBeDefined();
      }
    },
  );

  it.each(upgrades)('resolve for upgrade $id', (upgrade) => {
    if (upgrade.family === 'class') {
      expect(upgrade.classId !== undefined && classIds.has(upgrade.classId)).toBe(true);
    } else {
      expect(upgrade.classId).toBeUndefined();
    }
  });
});

describe('CONTENT numbers', () => {
  it('are finite and never negative', () => {
    const wrong = allNumbers.filter(({ value }) => !Number.isFinite(value) || value < 0);

    expect(wrong.map(({ path }) => path)).toEqual([]);
  });

  it('count durations in whole ticks', () => {
    const wrong = allNumbers.filter(
      ({ key, value }) => key.endsWith('Ticks') && !Number.isInteger(value),
    );

    expect(wrong.map(({ path }) => path)).toEqual([]);
  });

  it.each(classes)('are positive where needed for class $id', (definition) => {
    const { attack } = definition;
    const skillFields = (skill: SkillDefinition) => effectFields(skill.effect);

    expect(
      invalid({
        maxHp: [definition.maxHp, positive],
        speed: [definition.speed, positive],
        radius: [definition.radius, positive],
        pickupRadius: [definition.pickupRadius, positive],
        damage: [attack.damage, positive],
        cooldownTicks: [attack.cooldownTicks, wholePositive],
        projectileSpeed: [attack.projectileSpeed, positive],
        projectileRadius: [attack.projectileRadius, positive],
        rangeTicks: [attack.rangeTicks, wholePositive],
        count: [attack.count, wholePositive],
        skillCooldownTicks: [definition.skill.cooldownTicks, wholePositive],
        ...skillFields(definition.skill),
        ...skillFields(definition.ultimate),
      }),
    ).toEqual([]);
    expect(definition.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(enemies)('are positive where needed for enemy $id', (enemy) => {
    expect(
      invalid({
        maxHp: [enemy.maxHp, positive],
        speed: [enemy.speed, positive],
        radius: [enemy.radius, positive],
        damage: [enemy.damage, positive],
        attackCooldownTicks: [enemy.attackCooldownTicks, wholePositive],
        aggroRadius: [enemy.aggroRadius, positive],
        vibesDrop: [enemy.vibesDrop, positive],
        hpScaling: [enemy.scalingPerPhrase.hp, atLeastOne],
        speedScaling: [enemy.scalingPerPhrase.speed, atLeastOne],
        ...(enemy.ranged === undefined ? {} : effectFields(enemy.ranged)),
        ...(enemy.special === undefined ? {} : effectFields(enemy.special)),
      }),
    ).toEqual([]);
    expect(enemy.ranged !== undefined).toBe(enemy.behaviour === 'shooter');
  });

  it.each(traps)('are positive where needed for trap $id', (trap) => {
    expect(
      invalid({
        cost: [trap.cost, positive],
        radius: [trap.radius, positive],
        hp: [trap.hp, positive],
        maxLevel: [trap.maxLevel, wholePositive],
        levelMul: [trap.levelMul, atLeastOne],
        ...effectFields(trap.effect),
      }),
    ).toEqual([]);
  });

  it.each(upgrades)('are sound for upgrade $id', (upgrade) => {
    expect(upgrade.maxStacks).toSatisfy(wholePositive);
    expect(upgrade.modifiers.length).toBeGreaterThan(0);
    for (const modifier of upgrade.modifiers) {
      const hasAdd = modifier.add !== undefined;
      const hasMul = modifier.mul !== undefined;

      expect(hasAdd !== hasMul, modifier.stat).toBe(true);
      expect(modifier.add ?? modifier.mul, modifier.stat).toSatisfy(positive);
      expect(modifier.mul, modifier.stat).not.toBe(1);
    }
  });
});

describe.each(sets)('set $id', (set) => {
  it('runs on the tick grid tempo', () => {
    expect(set.bpm).toBe(DEFAULT_BPM);
  });

  it('has positive dimensions, core, economy and level curve', () => {
    expect(
      invalid({
        width: [set.arena.width, positive],
        height: [set.arena.height, positive],
        coreRadius: [set.core.radius, positive],
        coreMaxHp: [set.core.maxHp, positive],
        wattsPerBar: [set.core.wattsPerBar, positive],
        maxTraps: [set.maxTraps, wholePositive],
        baseVibes: [set.levelCurve.baseVibes, positive],
        vibesPerLevel: [set.levelCurve.vibesPerLevel, positive],
        pickupLifetimeTicks: [set.pickups.lifetimeTicks, wholePositive],
        pickupSpeed: [set.pickups.speed, positive],
      }),
    ).toEqual([]);
    expect(set.tiers.length).toBeGreaterThan(0);
  });

  it('flies its pickups faster than any class runs, so they always catch their player', () => {
    const fastest = Math.max(...classes.map((definition) => definition.speed));

    expect(set.pickups.speed).toBeGreaterThan(fastest);
  });

  it.each(set.tiers.map((tier, index) => [index, tier] as const))(
    'tier %i has a buildup, a break and spawn rules on whole phrases',
    (_, tier) => {
      expect(tier.buildupPhrases).toSatisfy(wholePositive);
      expect(tier.breakBars).toSatisfy(wholePositive);
      expect(tier.spawns.length).toBeGreaterThan(0);
      for (const rule of tier.spawns) {
        const lastPhrase = rule.toPhrase ?? tier.buildupPhrases - 1;

        expect(BARS_PER_PHRASE % rule.everyBars, rule.enemyId).toBe(0);
        expect(rule.everyBars, rule.enemyId).toSatisfy(wholePositive);
        expect(rule.count, rule.enemyId).toSatisfy(wholePositive);
        expect(Number.isInteger(rule.fromPhrase), rule.enemyId).toBe(true);
        expect(rule.fromPhrase, rule.enemyId).toBeLessThanOrEqual(lastPhrase);
        expect(lastPhrase, rule.enemyId).toBeLessThan(tier.buildupPhrases);
      }
      for (const rule of tier.bystanderSpawns ?? []) {
        const lastPhrase = rule.toPhrase ?? tier.buildupPhrases - 1;

        expect(BARS_PER_PHRASE % rule.everyBars, rule.bystanderId).toBe(0);
        expect(rule.everyBars, rule.bystanderId).toSatisfy(wholePositive);
        expect(rule.count, rule.bystanderId).toSatisfy(wholePositive);
        expect(Number.isInteger(rule.fromPhrase), rule.bystanderId).toBe(true);
        expect(rule.fromPhrase, rule.bystanderId).toBeLessThanOrEqual(lastPhrase);
        expect(lastPhrase, rule.bystanderId).toBeLessThan(tier.buildupPhrases);
      }
    },
  );

  it.each(set.tiers.map((tier, index) => [index, tier] as const))(
    'tier %i spawns more bad vibes every phrase',
    (_, tier) => {
      const perPhrase = Array.from({ length: tier.buildupPhrases }, (__, phrase) =>
        spawnsInPhrase(tier, phrase),
      );

      expect(perPhrase[0]).toBeGreaterThan(0);
      perPhrase.slice(1).forEach((count, index) => {
        expect(count).toBeGreaterThan(perPhrase[index] ?? Infinity);
      });
    },
  );

  it('lasts under ten minutes without its drops', () => {
    const ticks = set.tiers.reduce(
      (total, tier) =>
        total + tier.buildupPhrases * TICKS_PER_PHRASE + tier.breakBars * TICKS_PER_BAR,
      0,
    );

    expect(ticks).toBeLessThan(10 * 60 * TICK_RATE_HZ);
  });
});

describe('CONTENT texts', () => {
  const forbiddenWords = new Set([
    'alcool',
    'apéro',
    'bière',
    'biere',
    'champagne',
    'cocktail',
    'ivre',
    'pinte',
    'rhum',
    'shot',
    'vin',
    'vodka',
    'whisky',
    'drogue',
    'drogues',
    'ecstasy',
    'joint',
    'lsd',
    'mdma',
    'pilule',
    'défoncé',
    'perché',
  ]);

  it('are written', () => {
    expect(allTexts.filter(({ value }) => value.trim() === '').map(({ path }) => path)).toEqual([]);
    expect(enemies.filter((enemy) => !enemy.description).map((enemy) => enemy.id)).toEqual([]);
  });

  it('never use a long dash', () => {
    expect(allTexts.filter(({ value }) => /[–—]/.test(value)).map(({ path }) => path)).toEqual([]);
  });

  it('never mention drugs or alcohol', () => {
    const offending = allTexts.filter(({ value }) =>
      value
        .toLowerCase()
        .split(/[^\p{L}]+/u)
        .some((word) => forbiddenWords.has(word)),
    );

    expect(offending.map(({ path }) => path)).toEqual([]);
  });

  it.each(upgrades)('speak to the player shortly for upgrade $id', (upgrade) => {
    const words = upgrade.description.toLowerCase().split(/[^\p{L}]+/u);

    expect(words.some((word) => ['tu', 'te', 'toi', 'ton', 'ta', 'tes'].includes(word))).toBe(true);
    expect(upgrade.description.length).toBeLessThanOrEqual(60);
  });
});

describe('V0 scope', () => {
  it('has the mage as the VJ with nova and laser show', () => {
    const mage = classes.find((definition) => definition.id === 'mage');

    expect(classes).toHaveLength(1);
    expect(mage?.color).toBe('#ff2bd6');
    expect(mage?.skill.effect.kind).toBe('nova');
    expect(mage?.ultimate.effect.kind).toBe('laserShow');
  });

  it('has four bad vibes and one boss per tier', () => {
    expect(enemies.map((enemy) => [enemy.id, enemy.behaviour])).toEqual([
      ['relou', 'rusher'],
      ['foule-au-bar', 'horde'],
      ['vigile', 'heavy'],
      ['pluie', 'shooter'],
      ['couvre-feu', 'boss'],
      ['batterie-a-plat', 'boss'],
    ]);
    expect(sets.find((set) => set.id === 'soiree-v0')?.tiers.map((tier) => tier.bossId)).toEqual([
      'couvre-feu',
      'batterie-a-plat',
    ]);
  });

  it('has the bass bin on the beat and the laser continuously', () => {
    expect(traps.map((trap) => [trap.id, trap.effect.kind, trap.cadence])).toEqual([
      ['caisson-de-basse', 'shockwave', 'beat'],
      ['laser', 'beam', 'continuous'],
    ]);
  });

  it('has at least twelve upgrades across the three families', () => {
    const family = (name: string) => upgrades.filter((upgrade) => upgrade.family === name);

    expect(upgrades.length).toBeGreaterThanOrEqual(12);
    expect(
      family('class').filter((upgrade) => upgrade.classId === 'mage').length,
    ).toBeGreaterThanOrEqual(4);
    expect(family('generic').length).toBeGreaterThanOrEqual(5);
    expect(family('defense').length).toBeGreaterThanOrEqual(3);
  });

  it('has the soiree-v0 set at 145 BPM with two tiers of four phrases and a four bar break', () => {
    const set = sets.find((candidate) => candidate.id === 'soiree-v0');

    expect(set?.bpm).toBe(145);
    expect(set?.arena).toEqual({ width: 1600, height: 1000 });
    expect(set?.tiers.map((tier) => [tier.buildupPhrases, tier.breakBars])).toEqual([
      [4, 4],
      [4, 4],
    ]);
  });
});

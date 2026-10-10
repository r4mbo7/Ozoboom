import { describe, expect, it } from 'vitest';
import {
  BARS_PER_PHRASE,
  DEFAULT_BPM,
  TICKS_PER_BAR,
  TICKS_PER_PHRASE,
  TICK_RATE_HZ,
} from '../shared/tempo';
import { CONTENT } from './content';
import type { TierDefinition } from './types';

const { classes, enemies, traps, upgrades, sets, bystanders = [] } = CONTENT;
const weapons = CONTENT.weapons ?? [];
const fusions = CONTENT.fusions ?? [];
const speakers = sets.flatMap((set) => set.speakers ?? []);

const enemyById = new Map(enemies.map((enemy) => [enemy.id, enemy]));
const bystanderById = new Map(bystanders.map((bystander) => [bystander.id, bystander]));
const classIds = new Set(classes.map((definition) => definition.id));
const weaponIds = new Set(weapons.map((weapon) => weapon.id));

const positive = (value: number) => Number.isFinite(value) && value > 0;
const nonNegative = (value: number) => Number.isFinite(value) && value >= 0;
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

function kindsInPhrase(tier: TierDefinition, phrase: number): Set<string> {
  return new Set(
    tier.spawns
      .filter((rule) => rule.fromPhrase <= phrase && phrase <= (rule.toPhrase ?? Infinity))
      .map((rule) => rule.enemyId),
  );
}

describe('CONTENT identifiers', () => {
  const collections: [string, string[]][] = [
    ['classes', classes.map((item) => item.id)],
    ['enemies', enemies.map((item) => item.id)],
    ['traps', traps.map((item) => item.id)],
    ['upgrades', upgrades.map((item) => item.id)],
    ['sets', sets.map((item) => item.id)],
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

describe('CONTENT weapons, fusions and speakers', () => {
  it('never shares an id between an upgrade and a weapon', () => {
    const upgradeIds = new Set(upgrades.map((upgrade) => upgrade.id));
    const clashing = weapons.filter((weapon) => upgradeIds.has(weapon.id));

    expect(clashing.map((weapon) => weapon.id)).toEqual([]);
  });

  it('has unique weapon ids', () => {
    expect(duplicates(weapons.map((weapon) => weapon.id))).toEqual([]);
  });

  it.each(weapons)('resolves its references and rhythm for weapon $id', (weapon) => {
    if (weapon.classAffinity !== undefined) {
      expect(classIds.has(weapon.classAffinity)).toBe(true);
    }
    if (weapon.evolvedFrom !== undefined) {
      expect(weaponIds.has(weapon.evolvedFrom)).toBe(true);
    }
    if (weapon.rhythm !== 'continuous') {
      for (const step of weapon.rhythm.steps) {
        expect(step).toBeGreaterThanOrEqual(0);
        expect(step).toBeLessThanOrEqual(15);
      }
    }
  });

  it.each(fusions)('resolves its weapon, upgrade and result for fusion to $resultId', (fusion) => {
    expect(weaponIds.has(fusion.weaponId)).toBe(true);
    expect(upgrades.some((upgrade) => upgrade.id === fusion.upgradeId)).toBe(true);
    expect(weaponIds.has(fusion.resultId)).toBe(true);
  });

  it.each(speakers)('sits in the arena and outside the core for speaker $id', (speaker) => {
    const set = sets.find((candidate) => (candidate.speakers ?? []).includes(speaker));
    if (set === undefined) {
      throw new Error(`speaker "${speaker.id}" is not in any set`);
    }

    expect(speaker.x - speaker.radius).toBeGreaterThanOrEqual(0);
    expect(speaker.x + speaker.radius).toBeLessThanOrEqual(set.arena.width);
    expect(speaker.y - speaker.radius).toBeGreaterThanOrEqual(0);
    expect(speaker.y + speaker.radius).toBeLessThanOrEqual(set.arena.height);

    const dx = speaker.x - set.arena.width / 2;
    const dy = speaker.y - set.arena.height / 2;
    expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThan(set.core.radius + speaker.radius);
    if (speaker.unlocksWeaponId !== undefined) {
      expect(weaponIds.has(speaker.unlocksWeaponId)).toBe(true);
    }
  });
});

describe('CONTENT circus weapons, rarities and relics', () => {
  const upgradeIds = new Set(upgrades.map((upgrade) => upgrade.id));

  it('has the ten circus weapons and seven evolved forms', () => {
    expect(weapons.filter((weapon) => weapon.evolvedFrom === undefined).map((w) => w.id)).toEqual([
      'baton-de-feu',
      'baton-du-diable',
      'cerceaux',
      'diabolo',
      'frisbee',
      'assiettes-chinoises',
      'totem',
      'eventails-de-feu',
      'monocycle',
      'ruban-arc-en-ciel',
    ]);
    expect(weapons.filter((weapon) => weapon.evolvedFrom !== undefined)).toHaveLength(7);
  });

  it.each(fusions)('points fusion to $resultId at a weapon evolved from its own', (fusion) => {
    const result = weapons.find((weapon) => weapon.id === fusion.resultId);

    expect(weaponIds.has(fusion.weaponId)).toBe(true);
    expect(upgradeIds.has(fusion.upgradeId)).toBe(true);
    expect(result?.evolvedFrom).toBe(fusion.weaponId);
  });

  it('fuses each weapon at most once and gives each evolved form one fusion', () => {
    const evolved = weapons.filter((weapon) => weapon.evolvedFrom !== undefined);

    expect(duplicates(fusions.map((fusion) => fusion.weaponId))).toEqual([]);
    expect(fusions.map((fusion) => fusion.resultId).sort()).toEqual(
      evolved.map((weapon) => weapon.id).sort(),
    );
  });

  it.each(upgrades.filter((upgrade) => upgrade.family !== 'relic'))(
    'gives $id a rare and a legendary form, on the stats of its common form',
    (upgrade) => {
      const stats = (modifiers: readonly { stat: string }[]) => modifiers.map((m) => m.stat);
      const { rare, legendary } = upgrade.rarities ?? {};

      expect(stats(rare?.modifiers ?? [])).toEqual(stats(upgrade.modifiers));
      expect(stats(legendary?.modifiers ?? [])).toEqual(stats(upgrade.modifiers));
      expect(new Set([upgrade.description, rare?.description, legendary?.description]).size).toBe(
        3,
      );
      expect(`${rare?.description ?? ''} ${legendary?.description ?? ''}`).not.toMatch(
        /rare|légendaire/i,
      );
    },
  );

  it('keeps a single entry per upgrade, thirteen of them besides the relics', () => {
    const ids = upgrades.map((upgrade) => upgrade.id);

    expect(upgrades.filter((upgrade) => upgrade.family !== 'relic')).toHaveLength(13);
    expect(ids.filter((id) => /-(rare|legendaire)$/.test(id))).toEqual([]);
    expect(upgrades.filter((upgrade) => upgrade.family === 'relic' && upgrade.rarities)).toEqual(
      [],
    );
  });

  it('opens rares at Volume 2 and legendaries at Volume 3', () => {
    const weights = CONTENT.rarityWeights ?? [];

    expect(weights.findIndex((row) => row.rare > 0)).toBe(2);
    expect(weights.findIndex((row) => row.legendary > 0)).toBe(3);
  });

  it('has six relics, one stack each, of two or three modifiers', () => {
    const relics = upgrades.filter((upgrade) => upgrade.family === 'relic');

    expect(relics).toHaveLength(6);
    for (const relic of relics) {
      expect(relic.maxStacks).toBe(1);
      expect(relic.modifiers.length).toBeGreaterThanOrEqual(2);
      expect(relic.modifiers.length).toBeLessThanOrEqual(3);
    }
  });

  it('has four speakers, each opening an existing weapon, and the ribbon alone behind all four', () => {
    expect(speakers.map((speaker) => [speaker.id, speaker.unlocksWeaponId])).toEqual([
      ['dome-chill', 'assiettes-chinoises'],
      ['foret', 'monocycle'],
      ['sub', 'totem'],
      ['cercle-acid', 'baton-du-diable'],
    ]);
    expect(speakers.map((speaker) => speaker.aura.kind)).toEqual([
      'mist',
      'mist',
      'shockwave',
      'lure',
    ]);
    expect(speakers.every((speaker) => speaker.plugBars === 2)).toBe(true);
    expect(weapons.filter((weapon) => weapon.unlockedBySpeakers !== undefined)).toEqual([
      expect.objectContaining({ id: 'ruban-arc-en-ciel', unlockedBySpeakers: 4 }),
    ]);
    expect(sets.every((set) => set.weaponSlots === 3 || set.speakers === undefined)).toBe(true);
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
        ...effectFields(definition.skill.effect),
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
        // A "shooter sans dégâts" (filmeur, bavard) threatens only through its special effect.
        damage: [enemy.damage, nonNegative],
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
        ...effectFields(trap.effect),
      }),
    ).toEqual([]);
  });

  it.each(bystanders)('are positive where needed for bystander $id', (bystander) => {
    expect(
      invalid({
        radius: [bystander.radius, positive],
        speed: [bystander.speed, positive],
        helpTicks: [bystander.helpTicks, wholePositive],
        vibesReward: [bystander.vibesReward, positive],
        vibesPenalty: [bystander.vibesPenalty, positive],
        lifetimeBars: [bystander.lifetimeBars, wholePositive],
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

  it.each(set.tiers.map((tier, index) => [index, tier] as const))(
    'tier %i introduces a bad vibe absent from its previous phrases, every phrase',
    (_, tier) => {
      const seen = new Set<string>();

      for (let phrase = 0; phrase < tier.buildupPhrases; phrase += 1) {
        const kinds = kindsInPhrase(tier, phrase);
        const introduced = [...kinds].filter((kind) => !seen.has(kind));

        expect(introduced.length, `phrase ${String(phrase)}`).toBeGreaterThan(0);
        for (const kind of kinds) {
          seen.add(kind);
        }
      }
    },
  );

  it('spawns every bad vibe of the bestiary and the distressed bystander', () => {
    const spawnedEnemyIds = new Set(
      set.tiers.flatMap((tier) => tier.spawns.map((rule) => rule.enemyId)),
    );
    const bestiary = enemies.filter((enemy) => enemy.behaviour !== 'boss').map((enemy) => enemy.id);
    const spawnedBystanderIds = new Set(
      set.tiers.flatMap((tier) => (tier.bystanderSpawns ?? []).map((rule) => rule.bystanderId)),
    );

    expect(bestiary.filter((id) => !spawnedEnemyIds.has(id))).toEqual([]);
    expect(bystanders.map((item) => item.id).filter((id) => !spawnedBystanderIds.has(id))).toEqual(
      [],
    );
  });

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

describe('V0.1 scope', () => {
  it('has the three classes, the VJ, the roadie and the care', () => {
    const mage = classes.find((definition) => definition.id === 'mage');

    expect(classes.map((definition) => definition.id)).toEqual(['mage', 'tank', 'healer']);
    expect(mage?.color).toBe('#ff2bd6');
    expect(mage?.skill.effect.kind).toBe('nova');
  });

  it('has the eleven bad vibes and two bosses of the V0.1 bestiary', () => {
    expect(enemies.map((enemy) => [enemy.id, enemy.behaviour])).toEqual([
      ['random', 'horde'],
      ['desagreable', 'rusher'],
      ['meprisant', 'shooter'],
      ['male-alpha', 'heavy'],
      ['collant', 'rusher'],
      ['intolerant', 'horde'],
      ['arnaqueur', 'rusher'],
      ['fatigue', 'horde'],
      ['filmeur', 'shooter'],
      ['bavard', 'shooter'],
      ['zombie', 'heavy'],
      ['couvre-feu', 'boss'],
      ['batterie-a-plat', 'boss'],
    ]);
    expect(sets.find((set) => set.id === 'soiree-v0')?.tiers.map((tier) => tier.bossId)).toEqual([
      'couvre-feu',
      'batterie-a-plat',
    ]);
  });

  it('has the special module each enemy points to, and no other', () => {
    expect(enemies.map((enemy) => [enemy.id, enemy.special?.kind])).toEqual([
      ['random', undefined],
      ['desagreable', 'shove'],
      ['meprisant', 'sigh'],
      ['male-alpha', 'frontGuard'],
      ['collant', 'cling'],
      ['intolerant', 'suppress'],
      ['arnaqueur', 'steal'],
      ['fatigue', 'yawn'],
      ['filmeur', 'dazzle'],
      ['bavard', 'babble'],
      ['zombie', 'revive'],
      ['couvre-feu', undefined],
      ['batterie-a-plat', undefined],
    ]);
  });

  it('has the Festivalier en détresse helped in a bar, rewarding more than it penalizes', () => {
    const bystander = bystanderById.get('festivalier-en-detresse');

    expect(bystander?.helpTicks).toBe(TICKS_PER_BAR);
    expect(bystander?.vibesReward).toBe(8);
    expect(bystander?.vibesPenalty).toBe(4);
    expect(bystander?.lifetimeBars).toBe(4);
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

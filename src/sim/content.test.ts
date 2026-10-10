import { describe, expect, it } from 'vitest';
import type {
  GameContent,
  SetDefinition,
  SpecialEffect,
  TierDefinition,
  WeaponEffect,
} from '../data/types';
import { resolveContent } from './content';
import { FIXTURE_CONTENT, FIXTURE_SET } from './fixtures';

const withTiers = (change: Partial<TierDefinition>): GameContent => ({
  ...FIXTURE_CONTENT,
  sets: [{ ...FIXTURE_SET, tiers: FIXTURE_SET.tiers.map((tier) => ({ ...tier, ...change })) }],
});

describe('resolveContent', () => {
  it('indexes every definition by its id', () => {
    const content = FIXTURE_CONTENT;

    const resolved = resolveContent(content);

    expect([...resolved.classes.keys()]).toEqual(['raver']);
    expect([...resolved.enemies.keys()]).toEqual(['grump', 'curfew']);
    expect([...resolved.traps.keys()]).toEqual(['subwoofer']);
    expect([...resolved.upgrades.keys()]).toEqual(['quick-feet', 'big-bass', 'wide-nova']);
    expect(resolved.sets.get('fixture-set')).toBe(FIXTURE_SET);
    expect([...resolved.bystanders.keys()]).toEqual([]);
  });

  it('loads a content without weapons nor speakers as before', () => {
    const content = FIXTURE_CONTENT;

    const resolved = resolveContent(content);

    expect([...resolved.weapons.keys()]).toEqual([]);
  });

  it('rejects a weapon whose effect has no module', () => {
    const content: GameContent = {
      ...FIXTURE_CONTENT,
      weapons: [
        {
          id: 'mystery-prop',
          name: 'Mystery prop',
          description: 'mystery',
          rhythm: 'continuous',
          effect: { kind: 'mystery' } as unknown as WeaponEffect,
          maxLevel: 1,
          levelMul: 1,
        },
      ],
    };

    expect(() => resolveContent(content)).toThrow(
      'weapon "mystery-prop" has no module for effect "mystery"',
    );
  });

  it('rejects a weapon id clashing with an upgrade id', () => {
    const content: GameContent = {
      ...FIXTURE_CONTENT,
      weapons: [
        {
          id: 'quick-feet',
          name: 'Quick feet',
          description: 'clash',
          rhythm: 'continuous',
          effect: { kind: 'sweep', damage: 1, radius: 1, arcDegrees: 1 },
          maxLevel: 1,
          levelMul: 1,
        },
      ],
    };

    expect(() => resolveContent(content)).toThrow(
      'weapon id clashes with an upgrade id: "quick-feet"',
    );
  });

  it('rejects a fusion whose weapon, upgrade or result is unknown', () => {
    const fireStick = {
      id: 'fire-stick',
      name: 'Fire stick',
      description: 'swing',
      rhythm: 'continuous' as const,
      effect: { kind: 'sweep', damage: 1, radius: 1, arcDegrees: 1 } as const,
      maxLevel: 1,
      levelMul: 1,
    };
    const content: GameContent = {
      ...FIXTURE_CONTENT,
      weapons: [fireStick],
      fusions: [{ weaponId: 'fire-stick', upgradeId: 'quick-feet', resultId: 'ghost' }],
    };

    expect(() => resolveContent(content)).toThrow('unknown result of fusion to "ghost": "ghost"');
  });

  it("rejects a speaker whose unlocked weapon doesn't exist", () => {
    const content: GameContent = {
      ...FIXTURE_CONTENT,
      sets: [
        {
          ...FIXTURE_SET,
          speakers: [
            {
              id: 'chill-dome',
              name: 'Dôme chill',
              description: 'un dôme calme',
              x: 10,
              y: 10,
              radius: 40,
              plugBars: 8,
              aura: { kind: 'mist', slowFactor: 0.5, healPerBar: 1, radius: 100 },
              unlocksWeaponId: 'ghost',
            },
          ],
        },
      ],
    };

    expect(() => resolveContent(content)).toThrow(
      'unknown unlocked weapon of speaker "chill-dome": "ghost"',
    );
  });

  it('rejects a tier whose boss is unknown', () => {
    const content = withTiers({ bossId: 'ghost' });

    expect(() => resolveContent(content)).toThrow(
      'unknown boss of tier 0 of set "fixture-set": "ghost"',
    );
  });

  it('rejects a spawn rule whose enemy is unknown', () => {
    const content = withTiers({
      spawns: [{ enemyId: 'ghost', everyBars: 1, count: 1, fromPhrase: 0 }],
    });

    expect(() => resolveContent(content)).toThrow(
      'unknown spawned enemy of tier 0 of set "fixture-set": "ghost"',
    );
  });

  it('rejects a drop spawn rule whose enemy is unknown', () => {
    const content = withTiers({
      dropSpawns: [{ enemyId: 'ghost', everyBars: 1, count: 1, fromPhrase: 0 }],
    });

    expect(() => resolveContent(content)).toThrow(
      'unknown drop escort enemy of tier 0 of set "fixture-set": "ghost"',
    );
  });

  it('rejects a bystander spawn rule whose bystander is unknown', () => {
    const content = withTiers({
      bystanderSpawns: [{ bystanderId: 'ghost', everyBars: 1, count: 1, fromPhrase: 0 }],
    });

    expect(() => resolveContent(content)).toThrow(
      'unknown spawned bystander of tier 0 of set "fixture-set": "ghost"',
    );
  });

  it('rejects an enemy whose special kind has no registered module', () => {
    const [grump, ...rest] = FIXTURE_CONTENT.enemies;
    if (grump === undefined) {
      throw new Error('expected the grump enemy');
    }
    const content: GameContent = {
      ...FIXTURE_CONTENT,
      enemies: [{ ...grump, special: { kind: 'tickle' } as unknown as SpecialEffect }, ...rest],
    };

    expect(() => resolveContent(content)).toThrow(
      'unknown special module for enemy "grump": "tickle"',
    );
  });

  it('rejects an upgrade whose class is unknown', () => {
    const content: GameContent = {
      ...FIXTURE_CONTENT,
      upgrades: FIXTURE_CONTENT.upgrades.map((upgrade) => ({ ...upgrade, classId: 'bard' })),
    };

    expect(() => resolveContent(content)).toThrow('unknown class of upgrade "quick-feet": "bard"');
  });

  it('rejects two definitions sharing an id', () => {
    const content: GameContent = {
      ...FIXTURE_CONTENT,
      traps: [...FIXTURE_CONTENT.traps, ...FIXTURE_CONTENT.traps],
    };

    expect(() => resolveContent(content)).toThrow('duplicate trap id: "subwoofer"');
  });

  it('rejects a set without tiers', () => {
    const content: GameContent = { ...FIXTURE_CONTENT, sets: [{ ...FIXTURE_SET, tiers: [] }] };

    expect(() => resolveContent(content)).toThrow('set "fixture-set" has no tier');
  });
});

describe('resolveContent co-op fields', () => {
  const withClass = (change: object): GameContent => ({
    ...FIXTURE_CONTENT,
    classes: FIXTURE_CONTENT.classes.map((definition, index) =>
      index === 0
        ? {
            ...definition,
            ...change,
            attack: { ...definition.attack, ...(change as { attack?: object }).attack },
          }
        : definition,
    ),
  });
  const withSet = (change: object): GameContent => ({
    ...FIXTURE_CONTENT,
    sets: [{ ...FIXTURE_SET, ...change }],
  });

  it.each([0, -1, Number.NaN])('rejects a reviveMul of %s', (value) => {
    const content = withClass({ reviveMul: value });

    expect(() => resolveContent(content)).toThrow('reviveMul of class "raver" must be positive');
  });

  it.each([0, -1])('rejects a reviveBars of %s', (value) => {
    const content = withSet({ reviveBars: value });

    expect(() => resolveContent(content)).toThrow(
      'reviveBars of set "fixture-set" must be positive',
    );
  });

  it.each(['spawnMul', 'enemyHpMul'] as const)('rejects a null or negative perPlayer.%s', (key) => {
    const valid = { spawnMul: 1, enemyHpMul: 1 };

    for (const value of [0, -0.5]) {
      const content = withSet({ perPlayer: { ...valid, [key]: value } });
      expect(() => resolveContent(content)).toThrow(
        `perPlayer.${key} of set "fixture-set" must be positive`,
      );
    }
  });

  it('rejects a negative knockback and accepts none or zero', () => {
    expect(() => resolveContent(withClass({ attack: { knockback: -1 } }))).toThrow(
      'attack knockback of class "raver" must not be negative',
    );
    expect(() => resolveContent(withClass({ attack: { knockback: 0 } }))).not.toThrow();
    expect(() => resolveContent(FIXTURE_CONTENT)).not.toThrow();
  });

  it('accepts valid co-op fields', () => {
    const content = withSet({ reviveBars: 2, perPlayer: { spawnMul: 1.2, enemyHpMul: 1.1 } });

    expect(() => resolveContent(withClass({ reviveMul: 2 }))).not.toThrow();
    expect(() => resolveContent(content)).not.toThrow();
  });
});

describe('resolveContent obstacles', () => {
  const withObstacles = (
    obstacles: { x: number; y: number; radius: number }[],
    speakers: NonNullable<SetDefinition['speakers']> = FIXTURE_SET.speakers ?? [],
  ): GameContent => ({
    ...FIXTURE_CONTENT,
    sets: [{ ...FIXTURE_SET, obstacles, speakers }],
  });

  it('accepts obstacles clear of the core and the speakers', () => {
    expect(() => resolveContent(withObstacles([{ x: 200, y: 200, radius: 50 }]))).not.toThrow();
  });

  it('rejects an obstacle leaving the arena', () => {
    expect(() => resolveContent(withObstacles([{ x: 20, y: 200, radius: 50 }]))).toThrow(
      /leaves the arena/,
    );
  });

  it('rejects an obstacle overlapping the core', () => {
    const { width, height } = FIXTURE_SET.arena;
    expect(() =>
      resolveContent(withObstacles([{ x: width / 2 + 60, y: height / 2, radius: 50 }])),
    ).toThrow(/overlaps the core/);
  });

  it('rejects an obstacle overlapping a speaker', () => {
    const speaker = {
      id: 'wall',
      name: 'Wall',
      description: 'Wall',
      x: 300,
      y: 300,
      radius: 40,
      plugBars: 1,
      aura: { kind: 'slow', radius: 100, factor: 0.5 },
    } as unknown as NonNullable<SetDefinition['speakers']>[number];

    expect(() =>
      resolveContent(withObstacles([{ x: 330, y: 300, radius: 50 }], [speaker])),
    ).toThrow(/overlaps speaker/);
  });
});

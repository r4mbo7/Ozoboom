import { describe, expect, it } from 'vitest';
import type { GameContent, TierDefinition } from '../data/types';
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

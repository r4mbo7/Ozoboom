import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_PHRASE, TICK_RATE_HZ } from '../shared/tempo';
import { CONTENT } from './content';

function find<T extends { id: string }>(items: readonly T[], id: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (item === undefined) {
    throw new Error(`Missing content: ${id}`);
  }
  return item;
}

const seconds = (ticks: number) => ticks / TICK_RATE_HZ;

const mage = find(CONTENT.classes, 'mage');
const desagreable = find(CONTENT.enemies, 'desagreable');
const meprisant = find(CONTENT.enemies, 'meprisant');
const caisson = find(CONTENT.traps, 'caisson-de-basse');
const set = find(CONTENT.sets, 'soiree-v0');

describe('starting values of soiree-v0 with the mage', () => {
  it('let the player cross the arena corner to corner in under ten seconds', () => {
    const { width, height } = set.arena;
    const diagonal = Math.sqrt(width * width + height * height);

    expect(seconds(diagonal / mage.speed)).toBeLessThan(10);
  });

  it('bring a désagréable from any edge to the core in six to twelve seconds', () => {
    const { width, height } = set.arena;
    const contact = set.core.radius + desagreable.radius;
    const fromNearestEdge = Math.min(width, height) / 2 - contact;
    const fromFarthestEdge = Math.max(width, height) / 2 - contact;

    expect(seconds(fromNearestEdge / desagreable.speed)).toBeGreaterThanOrEqual(6);
    expect(seconds(fromFarthestEdge / desagreable.speed)).toBeLessThanOrEqual(12);
  });

  it('let the mage kill a first phrase désagréable in two or three hits', () => {
    const hits = Math.ceil(desagreable.maxHp / mage.attack.damage);

    expect(hits).toBeGreaterThanOrEqual(2);
    expect(hits).toBeLessThanOrEqual(3);
  });

  it('price a bass bin at two to four bars of watts', () => {
    const bars = caisson.cost / set.core.wattsPerBar;

    expect(bars).toBeGreaterThanOrEqual(2);
    expect(bars).toBeLessThanOrEqual(4);
  });

  it('let the first bass bin be placed right away', () => {
    expect(set.startingWatts).toBeGreaterThanOrEqual(caisson.cost);
  });

  it('let the méprisant reach its target from where it stands', () => {
    const ranged = meprisant.ranged ?? { projectileSpeed: 0, rangeTicks: 0, keepDistance: 0 };

    expect(ranged.projectileSpeed * ranged.rangeTicks).toBeGreaterThan(ranged.keepDistance);
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

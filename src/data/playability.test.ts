import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_PHRASE, TICK_RATE_HZ } from '../shared/tempo';
import { CONTENT } from './content';
import type { WeaponDefinition } from './types';

function find<T extends { id: string }>(items: readonly T[], id: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (item === undefined) {
    throw new Error(`Missing content: ${id}`);
  }
  return item;
}

const seconds = (ticks: number) => ticks / TICK_RATE_HZ;

const mage = find(CONTENT.classes, 'mage');
const startingClasses = ['mage', 'tank', 'healer'].map((id) => find(CONTENT.classes, id));
const desagreable = find(CONTENT.enemies, 'desagreable');
const meprisant = find(CONTENT.enemies, 'meprisant');
const caisson = find(CONTENT.traps, 'caisson-de-basse');
const set = find(CONTENT.sets, 'soiree-v0');

describe.each(startingClasses)('starting values of soiree-v0 with $id', (player) => {
  it('let the player cross the arena corner to corner in under ten seconds', () => {
    const { width, height } = set.arena;
    const diagonal = Math.sqrt(width * width + height * height);

    expect(seconds(diagonal / player.speed)).toBeLessThan(10);
  });

  it('let the player kill a first phrase désagréable in two or three hits', () => {
    const hits = Math.ceil(desagreable.maxHp / player.attack.damage);

    expect(hits).toBeGreaterThanOrEqual(2);
    expect(hits).toBeLessThanOrEqual(3);
  });

  it('reach a désagréable from where the player stands', () => {
    const reach = player.attack.projectileSpeed * player.attack.rangeTicks;

    expect(reach).toBeGreaterThan(player.radius + desagreable.radius + 40);
  });
});

describe('starting values of soiree-v0', () => {
  it('bring a désagréable from any edge to the core in six to twelve seconds', () => {
    const { width, height } = set.arena;
    const contact = set.core.radius + desagreable.radius;
    const fromNearestEdge = Math.min(width, height) / 2 - contact;
    const fromFarthestEdge = Math.max(width, height) / 2 - contact;

    expect(seconds(fromNearestEdge / desagreable.speed)).toBeGreaterThanOrEqual(6);
    expect(seconds(fromFarthestEdge / desagreable.speed)).toBeLessThanOrEqual(12);
  });

  it('put a bass bin in every hand from the start, and in the first loot', () => {
    expect(set.startingHand).toEqual([caisson.id]);
    expect(set.loot?.first).toBe(caisson.id);
  });

  it('make the bass bin the most common trap of a loot', () => {
    const others = CONTENT.traps.filter((trap) => trap.id !== caisson.id);

    expect(others.every((trap) => trap.lootWeight < caisson.lootWeight)).toBe(true);
  });

  it('carry a loot about every twenty seconds', () => {
    expect(seconds((set.loot?.everyBars ?? 0) * TICKS_PER_BAR)).toBeCloseTo(20, -1);
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

describe('circus weapons at level 1', () => {
  const weapons = CONTENT.weapons ?? [];
  const mageDamagePerBar = (TICKS_PER_BAR / mage.attack.cooldownTicks) * mage.attack.damage;
  const baseWeapons = weapons.filter((weapon) => weapon.evolvedFrom === undefined);

  function damagePerBar(weapon: WeaponDefinition): number | undefined {
    const { effect, rhythm } = weapon;
    if (rhythm === 'continuous') {
      return effect.kind === 'orbit'
        ? effect.damage * effect.count * effect.turnsPerBar
        : undefined;
    }
    const triggersPerBar = rhythm.steps.length / rhythm.everyBars;
    return 'damage' in effect ? effect.damage * triggersPerBar : undefined;
  }

  it.each(baseWeapons.filter((weapon) => damagePerBar(weapon) !== undefined))(
    'deals a quarter to half of the mage attack per bar for $id',
    (weapon) => {
      const perBar = damagePerBar(weapon) ?? 0;

      expect(perBar).toBeGreaterThanOrEqual(mageDamagePerBar / 4);
      expect(perBar).toBeLessThanOrEqual(mageDamagePerBar / 2);
    },
  );

  it('plants a totem for at least four bars', () => {
    const effect = find(weapons, 'totem').effect;

    expect(effect.kind === 'totem' ? effect.durationBars : 0).toBeGreaterThanOrEqual(4);
  });

  it.each(CONTENT.sets.flatMap((candidate) => candidate.speakers ?? []))(
    'puts speaker $id more than 300 units from the core',
    (speaker) => {
      const dx = speaker.x - set.arena.width / 2;
      const dy = speaker.y - set.arena.height / 2;

      expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThan(300);
    },
  );
});

describe('the roadie charge', () => {
  const dash = find(CONTENT.classes, 'tank').skill.effect;
  const tauntRadius = dash.kind === 'dash' ? (dash.tauntRadius ?? 0) : 0;

  it('draws a crowd wider than the aggro of a désagréable, which then keeps chasing the roadie', () => {
    expect(tauntRadius + desagreable.radius).toBeGreaterThan(desagreable.aggroRadius);
    expect(tauntRadius + desagreable.radius).toBeLessThan(desagreable.aggroRadius * 2);
  });

  it('is ready again within three bars', () => {
    expect(find(CONTENT.classes, 'tank').skill.cooldownTicks).toBeLessThanOrEqual(
      3 * TICKS_PER_BAR,
    );
  });

  it('stays a skill: at least two bars to recharge, a radius under 200', () => {
    expect(find(CONTENT.classes, 'tank').skill.cooldownTicks).toBeGreaterThanOrEqual(
      2 * TICKS_PER_BAR,
    );
    expect(tauntRadius).toBeLessThan(200);
  });
});

describe('the roles of the three classes', () => {
  const [vj, roadie, care] = ['mage', 'tank', 'healer'].map((id) => find(CONTENT.classes, id));

  it('give the roadie the most life, the VJ the least and the care in between', () => {
    expect(roadie?.maxHp).toBeGreaterThan(care?.maxHp ?? Infinity);
    expect(care?.maxHp).toBeGreaterThan(vj?.maxHp ?? Infinity);
  });

  it('let the care really repair the stage', () => {
    const effect = care?.skill.effect;

    expect(effect?.kind === 'healPulse' ? effect.coreRepair : 0).toBeGreaterThanOrEqual(25);
  });
});

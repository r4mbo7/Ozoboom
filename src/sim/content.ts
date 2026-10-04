import type {
  BystanderDefinition,
  ClassDefinition,
  EnemyDefinition,
  GameContent,
  SetDefinition,
  TrapDefinition,
  UpgradeDefinition,
  WeaponDefinition,
} from '../data/types';
import { SPECIALS } from './specials';
import { WEAPONS } from './systems/weapons';

export interface ResolvedContent {
  readonly classes: ReadonlyMap<string, ClassDefinition>;
  readonly enemies: ReadonlyMap<string, EnemyDefinition>;
  readonly traps: ReadonlyMap<string, TrapDefinition>;
  readonly upgrades: ReadonlyMap<string, UpgradeDefinition>;
  readonly sets: ReadonlyMap<string, SetDefinition>;
  readonly bystanders: ReadonlyMap<string, BystanderDefinition>;
  readonly weapons: ReadonlyMap<string, WeaponDefinition>;
}

export function resolveContent(content: GameContent): ResolvedContent {
  const resolved: ResolvedContent = {
    classes: indexById(content.classes, 'class'),
    enemies: indexById(content.enemies, 'enemy'),
    traps: indexById(content.traps, 'trap'),
    upgrades: indexById(content.upgrades, 'upgrade'),
    sets: indexById(content.sets, 'set'),
    bystanders: indexById(content.bystanders ?? [], 'bystander'),
    weapons: indexById(content.weapons ?? [], 'weapon'),
  };

  for (const enemy of content.enemies) {
    if (enemy.special !== undefined && !Object.hasOwn(SPECIALS, enemy.special.kind)) {
      throw new Error(`unknown special module for enemy "${enemy.id}": "${enemy.special.kind}"`);
    }
  }
  for (const upgrade of content.upgrades) {
    if (upgrade.classId !== undefined) {
      lookup(resolved.classes, upgrade.classId, `class of upgrade "${upgrade.id}"`);
    }
  }
  for (const weapon of resolved.weapons.values()) {
    if (resolved.upgrades.has(weapon.id)) {
      throw new Error(`weapon id clashes with an upgrade id: "${weapon.id}"`);
    }
    if (!(weapon.effect.kind in WEAPONS)) {
      throw new Error(`weapon "${weapon.id}" has no module for effect "${weapon.effect.kind}"`);
    }
    if (weapon.classAffinity !== undefined) {
      lookup(resolved.classes, weapon.classAffinity, `class affinity of weapon "${weapon.id}"`);
    }
    if (weapon.evolvedFrom !== undefined) {
      lookup(resolved.weapons, weapon.evolvedFrom, `evolved weapon of "${weapon.id}"`);
    }
  }
  for (const fusion of content.fusions ?? []) {
    lookup(resolved.weapons, fusion.weaponId, `weapon of fusion to "${fusion.resultId}"`);
    lookup(resolved.upgrades, fusion.upgradeId, `upgrade of fusion to "${fusion.resultId}"`);
    lookup(resolved.weapons, fusion.resultId, `result of fusion to "${fusion.resultId}"`);
  }
  for (const set of content.sets) {
    if (set.tiers.length === 0) {
      throw new Error(`set "${set.id}" has no tier`);
    }
    set.tiers.forEach((tier, index) => {
      const where = `tier ${String(index)} of set "${set.id}"`;
      lookup(resolved.enemies, tier.bossId, `boss of ${where}`);
      for (const spawn of tier.spawns) {
        lookup(resolved.enemies, spawn.enemyId, `spawned enemy of ${where}`);
      }
      for (const spawn of tier.bystanderSpawns ?? []) {
        lookup(resolved.bystanders, spawn.bystanderId, `spawned bystander of ${where}`);
      }
    });
    for (const speaker of set.speakers ?? []) {
      if (speaker.unlocksWeaponId !== undefined) {
        lookup(
          resolved.weapons,
          speaker.unlocksWeaponId,
          `unlocked weapon of speaker "${speaker.id}"`,
        );
      }
    }
  }

  return resolved;
}

export function lookup<T>(table: ReadonlyMap<string, T>, id: string, what: string): T {
  const entry = table.get(id);
  if (entry === undefined) {
    throw new Error(`unknown ${what}: "${id}"`);
  }
  return entry;
}

function indexById<T extends { readonly id: string }>(
  definitions: readonly T[],
  what: string,
): ReadonlyMap<string, T> {
  const table = new Map<string, T>();
  for (const definition of definitions) {
    if (table.has(definition.id)) {
      throw new Error(`duplicate ${what} id: "${definition.id}"`);
    }
    table.set(definition.id, definition);
  }
  return table;
}

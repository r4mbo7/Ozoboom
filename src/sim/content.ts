import type {
  ClassDefinition,
  EnemyDefinition,
  GameContent,
  SetDefinition,
  TrapDefinition,
  UpgradeDefinition,
} from '../data/types';

export interface ResolvedContent {
  readonly classes: ReadonlyMap<string, ClassDefinition>;
  readonly enemies: ReadonlyMap<string, EnemyDefinition>;
  readonly traps: ReadonlyMap<string, TrapDefinition>;
  readonly upgrades: ReadonlyMap<string, UpgradeDefinition>;
  readonly sets: ReadonlyMap<string, SetDefinition>;
}

export function resolveContent(content: GameContent): ResolvedContent {
  const resolved: ResolvedContent = {
    classes: indexById(content.classes, 'class'),
    enemies: indexById(content.enemies, 'enemy'),
    traps: indexById(content.traps, 'trap'),
    upgrades: indexById(content.upgrades, 'upgrade'),
    sets: indexById(content.sets, 'set'),
  };

  for (const upgrade of content.upgrades) {
    if (upgrade.classId !== undefined) {
      lookup(resolved.classes, upgrade.classId, `class of upgrade "${upgrade.id}"`);
    }
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
    });
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

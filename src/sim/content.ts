import type {
  DashDefinition,
  BystanderDefinition,
  ClassDefinition,
  EnemyDefinition,
  FusionDefinition,
  GameContent,
  GaugeDefinition,
  RarityWeights,
  RecruitDefinition,
  SetDefinition,
  SummonDefinition,
  TrapDefinition,
  UpgradeDefinition,
  WeaponDefinition,
} from '../data/types';
import { ATTACKS } from './attacks';
import { GAUGES } from './systems/gauges';
import { SKILLS } from './skills';
import { SPECIALS } from './specials';
import { WEAPONS } from './systems/weapons';
import { lookup } from './lookup';

export { lookup };

export interface ResolvedContent {
  readonly classes: ReadonlyMap<string, ClassDefinition>;
  readonly enemies: ReadonlyMap<string, EnemyDefinition>;
  readonly traps: ReadonlyMap<string, TrapDefinition>;
  readonly upgrades: ReadonlyMap<string, UpgradeDefinition>;
  readonly sets: ReadonlyMap<string, SetDefinition>;
  readonly bystanders: ReadonlyMap<string, BystanderDefinition>;
  readonly weapons: ReadonlyMap<string, WeaponDefinition>;
  readonly fusions: readonly FusionDefinition[];
  readonly rarityWeights: readonly RarityWeights[];
  readonly dash: DashDefinition | null;
  // By set id, the sets where a team calls more bosses.
  readonly summons: ReadonlyMap<string, SummonDefinition>;
}

export function resolveContent(content: GameContent): ResolvedContent {
  const resolved: ResolvedContent = {
    classes: indexById(content.classes, 'class'),
    enemies: indexById(content.enemies, 'enemy'),
    traps: indexById(content.traps, 'trap'),
    upgrades: indexById(content.upgrades, 'upgrade'),
    sets: indexById([...content.sets, ...(content.paths ?? [])], 'set'),
    bystanders: indexById(content.bystanders ?? [], 'bystander'),
    weapons: indexById(content.weapons ?? [], 'weapon'),
    fusions: content.fusions ?? [],
    rarityWeights: content.rarityWeights ?? [],
    dash: content.dash ?? null,
    summons: new Map((content.summons ?? []).map((summon) => [summon.setId, summon])),
  };

  for (const [setId, summon] of resolved.summons) {
    if (summon.sources.length === 0 || summon.sites.length === 0) {
      throw new Error(`the summon of set "${setId}" needs a source and a site`);
    }
    if (
      [...summon.sources.map((s) => s.items), ...summon.sites.map((s) => s.capacity)].some(
        (n) => n <= 0,
      )
    ) {
      throw new Error(`the summon of set "${setId}" has a source or a site that holds nothing`);
    }
  }
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
  for (const definition of content.classes) {
    if (!Object.hasOwn(ATTACKS, definition.attack.kind)) {
      throw new Error(
        `class "${definition.id}" has no module for attack "${definition.attack.kind}"`,
      );
    }
    if (!Object.hasOwn(SKILLS, definition.skill.effect.kind)) {
      throw new Error(
        `class "${definition.id}" has no module for skill "${definition.skill.effect.kind}"`,
      );
    }
    for (const weaponId of definition.affinityWeaponIds ?? []) {
      lookup(resolved.weapons, weaponId, `affinity weapon of class "${definition.id}"`);
    }
    for (const weaponId of definition.excludedWeaponIds ?? []) {
      lookup(resolved.weapons, weaponId, `excluded weapon of class "${definition.id}"`);
      if (definition.affinityWeaponIds?.includes(weaponId) === true) {
        throw new Error(
          `class "${definition.id}" both favours and excludes the weapon "${weaponId}"`,
        );
      }
    }
    requirePositive(definition.reviveMul, `reviveMul of class "${definition.id}"`);
    if ('knockback' in definition.attack) {
      requireNonNegative(
        definition.attack.knockback,
        `attack knockback of class "${definition.id}"`,
      );
    }
    if (definition.gauge !== undefined) {
      requireGauge(definition.id, definition.gauge);
    }
    if (definition.recruits !== undefined) {
      requireRecruits(definition.id, definition.recruits);
    }
  }
  if (!content.enemies.some((enemy) => enemy.behaviour === 'boss')) {
    throw new Error('no boss for the drops to draw from');
  }
  for (const set of content.sets) {
    requirePositive(set.reviveBars, `reviveBars of set "${set.id}"`);
    requirePositive(set.perPlayer?.spawnMul, `perPlayer.spawnMul of set "${set.id}"`);
    requirePositive(set.perPlayer?.enemyHpMul, `perPlayer.enemyHpMul of set "${set.id}"`);
    requirePositive(set.endlessPerMinute?.hp, `endlessPerMinute.hp of set "${set.id}"`);
    requirePositive(set.endlessPerMinute?.damage, `endlessPerMinute.damage of set "${set.id}"`);
    if (set.tiers.length === 0) {
      throw new Error(`set "${set.id}" has no tier`);
    }
    set.tiers.forEach((tier, index) => {
      const where = `tier ${String(index)} of set "${set.id}"`;
      for (const spawn of tier.spawns) {
        lookup(resolved.enemies, spawn.enemyId, `spawned enemy of ${where}`);
      }
      for (const spawn of tier.dropSpawns ?? []) {
        lookup(resolved.enemies, spawn.enemyId, `drop escort enemy of ${where}`);
      }
      for (const spawn of tier.bystanderSpawns ?? []) {
        lookup(resolved.bystanders, spawn.bystanderId, `spawned bystander of ${where}`);
      }
    });
    for (const obstacle of set.obstacles ?? []) {
      const where = `obstacle (${String(obstacle.x)}, ${String(obstacle.y)}) of set "${set.id}"`;
      const { width, height } = set.arena;
      if (
        obstacle.x - obstacle.radius < 0 ||
        obstacle.y - obstacle.radius < 0 ||
        obstacle.x + obstacle.radius > width ||
        obstacle.y + obstacle.radius > height
      ) {
        throw new Error(`${where} leaves the arena`);
      }
      if (circlesOverlap(obstacle, { x: width / 2, y: height / 2, radius: set.core.radius })) {
        throw new Error(`${where} overlaps the core`);
      }
      for (const speaker of set.speakers ?? []) {
        if (circlesOverlap(obstacle, speaker)) {
          throw new Error(`${where} overlaps speaker "${speaker.id}"`);
        }
      }
    }
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

function circlesOverlap(
  a: { x: number; y: number; radius: number },
  b: { x: number; y: number; radius: number },
): boolean {
  const reach = a.radius + b.radius;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < reach * reach;
}

function requirePositive(value: number | undefined, what: string): void {
  if (value !== undefined && !(Number.isFinite(value) && value > 0)) {
    throw new Error(`${what} must be positive, got ${String(value)}`);
  }
}

function requireGauge(classId: string, gauge: GaugeDefinition): void {
  if (!Object.hasOwn(GAUGES, gauge.kind)) {
    throw new Error(`class "${classId}" has no module for gauge "${gauge.kind}"`);
  }
  const what = `of the gauge of class "${classId}"`;
  requirePositive(gauge.max, `max ${what}`);
  if (gauge.start !== undefined && !(gauge.start >= 0 && gauge.start <= gauge.max)) {
    throw new Error(
      `start ${what} must be within 0 and ${String(gauge.max)}, got ${String(gauge.start)}`,
    );
  }
}

function requireRecruits(classId: string, recruits: RecruitDefinition): void {
  const what = `of the recruits of class "${classId}"`;
  for (const key of ['bars', 'max', 'damage', 'speed'] as const) {
    requirePositive(recruits[key], `${key} ${what}`);
  }
  if (!Number.isInteger(recruits.max)) {
    throw new Error(`max ${what} must be a whole number, got ${String(recruits.max)}`);
  }
  requireNonNegative(recruits.knockback, `knockback ${what}`);
}

function requireNonNegative(value: number | undefined, what: string): void {
  if (value !== undefined && !(Number.isFinite(value) && value >= 0)) {
    throw new Error(`${what} must not be negative, got ${String(value)}`);
  }
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

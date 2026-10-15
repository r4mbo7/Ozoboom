import type {
  ClassDefinition,
  Rarity,
  RarityForm,
  SetDefinition,
  SkillDefinition,
  StatKey,
  StatModifier,
  UpgradeDefinition,
} from '../data/types';
import { wholeTicks } from './effects';
import type { PlayerState, SimState } from './state';

const ADDITIVE: Readonly<Record<StatKey, boolean>> = {
  maxHpAdd: true,
  speedMul: false,
  pickupRadiusMul: false,
  damageMul: false,
  attackCooldownMul: false,
  projectileSpeedMul: false,
  projectileCountAdd: true,
  pierceAdd: true,
  skillCooldownMul: false,
  skillPowerMul: false,
  trapDamageMul: false,
  trapRadiusMul: false,
  trapSlotsAdd: true,
  lootIntervalMul: false,
  lootRadiusMul: false,
};

export function statValue(
  player: Pick<PlayerState, 'modifiers' | 'suppressedTicks'>,
  key: StatKey,
  base: number,
): number {
  if ((player.suppressedTicks ?? 0) > 0) {
    return base;
  }
  const modifier = player.modifiers[key];
  if (modifier === undefined) {
    return base;
  }
  return ADDITIVE[key] ? base + modifier : base * modifier;
}

export function skillCooldownTicks(
  player: Pick<PlayerState, 'modifiers'>,
  skill: Pick<SkillDefinition, 'cooldownTicks'>,
): number {
  return wholeTicks(statValue(player, 'skillCooldownMul', skill.cooldownTicks));
}

export function trapCapacity(
  set: Pick<SetDefinition, 'maxTraps'>,
  state: Pick<SimState, 'volume' | 'players'>,
): number {
  let capacity = set.maxTraps + (state.volume ?? 0);
  for (const player of state.players) {
    capacity = statValue(player, 'trapSlotsAdd', capacity);
  }
  return capacity;
}

export function upgradeForm(upgrade: UpgradeDefinition, rarity: Rarity): RarityForm {
  if (rarity === 'common') {
    return upgrade;
  }
  const form = upgrade.rarities?.[rarity];
  if (form === undefined) {
    throw new Error(`upgrade "${upgrade.id}" has no ${rarity} form`);
  }
  return form;
}

export function applyModifiers(
  player: Pick<PlayerState, 'modifiers'>,
  modifiers: readonly StatModifier[],
): void {
  for (const { stat, add = 0, mul = 1 } of modifiers) {
    const current = player.modifiers[stat] ?? (ADDITIVE[stat] ? 0 : 1);
    player.modifiers[stat] = (current + add) * mul;
  }
}

// Recomputes maxHp and speed, leaving hp untouched: for a temporary effect (suppress) that must
// not cost or grant hp points while it holds the derived stats down to their base value.
export function applyDerivedStats(
  player: Pick<PlayerState, 'modifiers' | 'suppressedTicks' | 'maxHp' | 'speed'>,
  definition: Pick<ClassDefinition, 'maxHp' | 'speed'>,
): void {
  player.maxHp = statValue(player, 'maxHpAdd', definition.maxHp);
  player.speed = statValue(player, 'speedMul', definition.speed);
}

export function refreshDerivedStats(
  player: PlayerState,
  definition: Pick<ClassDefinition, 'maxHp' | 'speed'>,
): void {
  const previousMaxHp = player.maxHp;
  applyDerivedStats(player, definition);
  player.hp += player.maxHp - previousMaxHp;
}

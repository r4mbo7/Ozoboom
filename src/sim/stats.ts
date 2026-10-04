import type { ClassDefinition, StatKey, StatModifier } from '../data/types';
import type { PlayerState } from './state';

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
  trapCostMul: false,
  trapRadiusMul: false,
  wattsPerBarAdd: true,
};

export function statValue(
  player: Pick<PlayerState, 'modifiers'>,
  key: StatKey,
  base: number,
): number {
  const modifier = player.modifiers[key];
  if (modifier === undefined) {
    return base;
  }
  return ADDITIVE[key] ? base + modifier : base * modifier;
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

export function refreshDerivedStats(
  player: PlayerState,
  definition: Pick<ClassDefinition, 'maxHp' | 'speed'>,
): void {
  const maxHp = statValue(player, 'maxHpAdd', definition.maxHp);
  player.hp += maxHp - player.maxHp;
  player.maxHp = maxHp;
  player.speed = statValue(player, 'speedMul', definition.speed);
}

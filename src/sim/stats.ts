import type {
  ClassDefinition,
  DashDefinition,
  GameContent,
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
  attackRadiusMul: false,
  projectileSpeedMul: false,
  projectileCountAdd: true,
  pierceAdd: true,
  skillCooldownMul: false,
  skillPowerMul: false,
  skillRadiusMul: false,
  trapDamageMul: false,
  trapRadiusMul: false,
  trapSlotsAdd: true,
  lootIntervalMul: false,
  lootRadiusMul: false,
  dashRechargeMul: false,
  dashChargesAdd: true,
  weaponRateMul: false,
  kiffDamageAdd: true,
  zoneCountAdd: true,
  rootsGrowthMul: false,
  skillCountAdd: true,
  echoCountAdd: true,
  echoPowerMul: false,
  twilightBeatsAdd: true,
  elementBeatsAdd: true,
  elementSpreadAdd: true,
};

export function statValue(
  player: Pick<PlayerState, 'modifiers' | 'suppressedTicks' | 'boosts'>,
  key: StatKey,
  base: number,
): number {
  if ((player.suppressedTicks ?? 0) > 0) {
    return base;
  }
  let modifier = player.modifiers[key];
  if (player.boosts !== undefined) {
    for (const boost of player.boosts) {
      for (const { stat, add = 0, mul = 1 } of boost.modifiers) {
        if (stat === key) {
          modifier = ((modifier ?? (ADDITIVE[key] ? 0 : 1)) + add) * mul;
        }
      }
    }
  }
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

type Carded = Pick<PlayerState, 'modifiers' | 'suppressedTicks' | 'boosts'>;

export function dashCharges(
  player: Carded,
  dash: Pick<DashDefinition, 'charges' | 'maxCharges'>,
): number {
  return Math.min(dash.maxCharges, statValue(player, 'dashChargesAdd', dash.charges));
}

export function dashRechargeBeats(
  player: Carded,
  dash: Pick<DashDefinition, 'rechargeBeats' | 'minRechargeBeats'>,
): number {
  const beats = Math.floor(statValue(player, 'dashRechargeMul', dash.rechargeBeats) + 0.5);
  return Math.max(dash.minRechargeBeats, beats);
}

export function handFree(player: PlayerState, set: Pick<SetDefinition, 'handSize'>): boolean {
  return (player.hand?.length ?? 0) + (player.offering === undefined ? 0 : 1) < set.handSize;
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

// Leaves hp untouched: a temporary effect (suppress) must not cost or grant hp.
export function applyDerivedStats(
  player: Pick<PlayerState, 'modifiers' | 'suppressedTicks' | 'boosts' | 'maxHp' | 'speed'>,
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

export function onlyGrowsDash(content: Pick<GameContent, 'upgrades'>, id: string): boolean {
  const upgrade = content.upgrades.find((candidate) => candidate.id === id);
  return upgrade?.modifiers.every((modifier) => modifier.stat.startsWith('dash')) === true;
}

export function growsSkillAlone(form: Pick<RarityForm, 'modifiers'>): boolean {
  return (
    form.modifiers.length > 0 &&
    form.modifiers.every((modifier) => modifier.stat.startsWith('skill'))
  );
}

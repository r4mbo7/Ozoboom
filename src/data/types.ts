export type StatKey =
  | 'maxHpAdd'
  | 'speedMul'
  | 'pickupRadiusMul'
  | 'damageMul'
  | 'attackCooldownMul'
  | 'projectileSpeedMul'
  | 'projectileCountAdd'
  | 'pierceAdd'
  | 'skillCooldownMul'
  | 'skillPowerMul'
  | 'trapDamageMul'
  | 'trapCostMul'
  | 'trapRadiusMul'
  | 'wattsPerBarAdd';

export interface StatModifier {
  stat: StatKey;
  add?: number;
  mul?: number;
}

export interface AttackDefinition {
  damage: number;
  cooldownTicks: number;
  projectileSpeed: number;
  projectileRadius: number;
  rangeTicks: number;
  pierce: number;
  count: number;
  spreadRadians: number;
}

export type SkillEffect =
  | { kind: 'nova'; damage: number; radius: number; knockback: number }
  | { kind: 'laserShow'; damagePerTick: number; radius: number; durationTicks: number }
  | { kind: 'dash'; distance: number; invulnerableTicks: number }
  | { kind: 'barrier'; hp: number; radius: number; durationTicks: number }
  | { kind: 'healPulse'; amount: number; radius: number; coreRepair: number };

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  cooldownTicks: number;
  effect: SkillEffect;
}

export interface ClassDefinition {
  id: string;
  name: string;
  role: string;
  color: string;
  maxHp: number;
  speed: number;
  radius: number;
  pickupRadius: number;
  attack: AttackDefinition;
  skill: SkillDefinition;
  ultimate: SkillDefinition;
}

export type EnemyBehaviour = 'rusher' | 'horde' | 'heavy' | 'shooter' | 'boss';

export type SpecialEffect =
  | { kind: 'shove'; knockback: number }
  | { kind: 'sigh'; slowFactor: number; durationTicks: number }
  | { kind: 'cling'; slowFactor: number; detachDamage: number }
  | { kind: 'suppress'; radius: number }
  | { kind: 'steal'; fleeSpeedMul: number }
  | { kind: 'yawn'; radius: number; slowFactor: number; awakeBars: number; sleepBars: number }
  | { kind: 'revive'; times: number; hpRatio: number; downBars: number }
  | { kind: 'dazzle'; radius: number }
  | { kind: 'babble'; everyBars: number };

export interface EnemyDefinition {
  id: string;
  name: string;
  description?: string;
  behaviour: EnemyBehaviour;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number;
  attackCooldownTicks: number;
  aggroRadius: number;
  vibesDrop: number;
  wattsDrop: number;
  // Compounded per phrase since the start of the set: value = base * factor ** phrase.
  scalingPerPhrase: { hp: number; speed: number };
  ranged?: {
    projectileSpeed: number;
    projectileRadius: number;
    rangeTicks: number;
    keepDistance: number;
  };
  special?: SpecialEffect;
}

export type TrapCadence = 'beat' | 'bar' | 'drop' | 'continuous';

export type TrapEffect =
  | { kind: 'shockwave'; damage: number; radius: number; knockback: number }
  | { kind: 'beam'; damagePerTick: number; length: number; width: number }
  | { kind: 'mist'; slowFactor: number; healPerBar: number; radius: number }
  | { kind: 'lure'; radius: number; markedDamageMul: number }
  | { kind: 'strobe'; stunTicks: number; radius: number };

export interface TrapDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  radius: number;
  hp: number;
  cadence: TrapCadence;
  effect: TrapEffect;
  maxLevel: number;
  levelMul: number;
}

export type UpgradeFamily = 'class' | 'generic' | 'defense';

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  family: UpgradeFamily;
  classId?: string;
  modifiers: readonly StatModifier[];
  maxStacks: number;
}

// Phrases count from 0 within the tier's buildup, toPhrase included.
export interface SpawnRule {
  enemyId: string;
  everyBars: number;
  count: number;
  fromPhrase: number;
  toPhrase?: number;
}

export interface BystanderDefinition {
  id: string;
  name: string;
  description: string;
  radius: number;
  speed: number;
  helpTicks: number;
  vibesReward: number;
  vibesPenalty: number;
  lifetimeBars: number;
}

// Phrases count from 0 within the tier's buildup, toPhrase included.
export interface BystanderSpawnRule {
  bystanderId: string;
  everyBars: number;
  count: number;
  fromPhrase: number;
  toPhrase?: number;
}

export interface TierDefinition {
  buildupPhrases: number;
  breakBars: number;
  bossId: string;
  spawns: readonly SpawnRule[];
  bystanderSpawns?: readonly BystanderSpawnRule[];
}

export interface SetDefinition {
  id: string;
  name: string;
  bpm: number;
  arena: { width: number; height: number };
  core: { radius: number; maxHp: number; wattsPerBar: number };
  startingWatts: number;
  maxTraps: number;
  levelCurve: { baseVibes: number; vibesPerLevel: number };
  pickups: { lifetimeTicks: number; speed: number };
  tiers: readonly TierDefinition[];
}

export interface GameContent {
  classes: readonly ClassDefinition[];
  enemies: readonly EnemyDefinition[];
  traps: readonly TrapDefinition[];
  upgrades: readonly UpgradeDefinition[];
  sets: readonly SetDefinition[];
  bystanders?: readonly BystanderDefinition[];
}

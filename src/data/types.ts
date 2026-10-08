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
  | 'trapSlotsAdd'
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
  knockback?: number;
}

export type SkillEffect =
  | { kind: 'nova'; damage: number; radius: number; knockback: number }
  | { kind: 'dash'; distance: number; invulnerableTicks: number; tauntRadius?: number }
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
  reviveMul?: number;
  attack: AttackDefinition;
  skill: SkillDefinition;
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
  | { kind: 'babble'; everyBars: number }
  | { kind: 'frontGuard'; frontDamageMul: number };

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

export type UpgradeFamily = 'class' | 'generic' | 'defense' | 'relic';

export type Rarity = 'common' | 'rare' | 'legendary';

export interface RarityForm {
  description: string;
  modifiers: readonly StatModifier[];
}

// `description` and `modifiers` are the common form.
export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  family: UpgradeFamily;
  classId?: string;
  // Absent, the upgrade is always drawn common.
  rarities?: { rare: RarityForm; legendary: RarityForm };
  modifiers: readonly StatModifier[];
  // Counts stacks of every rarity.
  maxStacks: number;
}

// Draw weights of each rarity, indexed by Volume; the last entry holds beyond.
export type RarityWeights = Record<Rarity, number>;

// `steps`: sixteenth notes, 0 to 15, within the bar.
export type WeaponRhythm = { everyBars: number; steps: readonly number[] } | 'continuous';

export type WeaponEffect =
  | { kind: 'sweep'; damage: number; radius: number; arcDegrees: number }
  | { kind: 'spark'; damage: number; speed: number; pierce: number; rangeTicks: number }
  | { kind: 'hoop'; damage: number; radius: number; wideRadius: number; knockback: number }
  | {
      kind: 'lob';
      damage: number;
      radius: number;
      range: number;
      flightTicks: number;
      // On the drop, the lob reaches the whole arena instead of `range`.
      dropRain?: boolean;
    }
  | { kind: 'boomerang'; damage: number; heal: number; range: number; speed: number }
  | {
      kind: 'plate';
      slowFactor: number;
      healPerBar: number;
      radius: number;
      durationBars: number;
      maxPlaced: number;
    }
  | { kind: 'totem'; damage: number; knockback: number; radius: number; durationBars: number }
  | {
      kind: 'orbit';
      damage: number;
      count: number;
      radius: number;
      orbitRadius: number;
      turnsPerBar: number;
    }
  | { kind: 'trail'; speedMul: number; slowFactor: number; healPerBar: number; lengthTicks: number }
  | {
      kind: 'ribbon';
      length: number;
      markedTicks: number;
      // On the drop, the ribbon crosses the whole arena instead of `length`.
      dropCrossesArena?: boolean;
    };

export interface WeaponDefinition {
  id: string;
  name: string;
  description: string;
  classAffinity?: string;
  unlockedBySpeakers?: number;
  evolvedFrom?: string;
  rhythm: WeaponRhythm;
  effect: WeaponEffect;
  maxLevel: number;
  levelMul: number;
}

export interface FusionDefinition {
  weaponId: string;
  upgradeId: string;
  resultId: string;
}

export interface SpeakerDefinition {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  radius: number;
  plugBars: number;
  aura: TrapEffect;
  unlocksWeaponId?: string;
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
  speakers?: readonly SpeakerDefinition[];
  // Absent means 3.
  weaponSlots?: number;
  reviveBars?: number;
  // Most the core can be repaired per bar, all sources together. Absent means no cap.
  coreRepairPerBar?: number;
  perPlayer?: { spawnMul: number; enemyHpMul: number };
  // Each window of `everyBars` bars comes from one or two sides with `chance`; `randomShare` of its
  // rule spawns still come from anywhere on the edge. Absent means every spawn comes from anywhere.
  sidedWaves?: { everyBars: number; chance: number; randomShare: number };
}

export interface GameContent {
  classes: readonly ClassDefinition[];
  enemies: readonly EnemyDefinition[];
  traps: readonly TrapDefinition[];
  upgrades: readonly UpgradeDefinition[];
  sets: readonly SetDefinition[];
  bystanders?: readonly BystanderDefinition[];
  weapons?: readonly WeaponDefinition[];
  fusions?: readonly FusionDefinition[];
  rarityWeights?: readonly RarityWeights[];
}

export type MusicVoiceId =
  | 'rolling-bass'
  | 'knock'
  | 'chirp'
  | 'zap'
  | 'crickets'
  | 'arp'
  | 'squelch'
  | 'lead'
  | 'oriental'
  | 'round-bass'
  | 'ghost-bass'
  | 'lake-pluck'
  | 'mist-lead'
  | 'droplet'
  | 'goa-lead'
  | 'gate'
  | 'goa-arp'
  | 'tom'
  | 'acid'
  | 'croak'
  | 'laser';

// The set's layers that let a part play. `lead` plays until the theme arrives, `theme` replaces it.
// `kick` plays out of the break, `clap` only in the drop.
export type MusicLayer =
  'bass' | 'texture' | 'arp' | 'squelch' | 'lead' | 'theme' | 'kick' | 'clap';

// [sixteenth within the loop, scale degree, length in sixteenths], in ascending sixteenths.
export type MusicNotes = readonly (readonly [step: number, degree: number, steps: number])[];

export interface MusicPart {
  voice: MusicVoiceId;
  layer: MusicLayer;
  loopSteps: number;
  octave: number;
  // The degree is added to the chord root of the bar.
  followsChord: boolean;
  notes: MusicNotes;
  // Absent: in and out of the break. `light`: only in the break, `full`: never in it.
  in?: 'full' | 'light';
  // Steps of the loop whose note is accented, or slides from the previous note.
  accents?: readonly number[];
  slides?: readonly number[];
}

// A background track. Every track plays at the set's tempo and follows its buildups, breaks and
// drops; the effects and the speaker layers play in its key.
export interface MusicTrack {
  id: string;
  name: string;
  rootMidi: number;
  scale: readonly number[];
  // Replaces the scale while the theme plays. Chord roots keep their pitch in both scales.
  themeScale?: readonly number[];
  // Chord root degree of each bar, cycled.
  chords: readonly number[];
  kick: { fromHz: number; release: number };
  // Hz the pad's filter opens by at each bar of the break.
  padOpens?: number;
  parts: readonly MusicPart[];
}

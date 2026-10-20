import type { FullAttack, FullSkillEffect, FullSpecialEffect } from './full';

export type StatKey =
  | 'maxHpAdd'
  | 'speedMul'
  | 'pickupRadiusMul'
  | 'damageMul'
  | 'attackCooldownMul'
  | 'attackRadiusMul'
  | 'projectileSpeedMul'
  | 'projectileCountAdd'
  | 'pierceAdd'
  | 'skillCooldownMul'
  | 'skillPowerMul'
  | 'skillRadiusMul'
  | 'trapDamageMul'
  | 'trapRadiusMul'
  | 'trapSlotsAdd'
  | 'lootIntervalMul'
  | 'lootRadiusMul'
  | 'dashRechargeMul'
  | 'dashChargesAdd'
  | 'weaponRateMul'
  | 'kiffDamageAdd'
  | 'zoneCountAdd';

export interface StatModifier {
  stat: StatKey;
  add?: number;
  mul?: number;
}

export interface StraightAttack {
  kind: 'straight';
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

// One member per kind of attack, each with its module in `ATTACKS` (src/sim/attacks).
export type AttackDefinition = StraightAttack | FullAttack;

// One member per kind of skill, each with its module in `SKILLS` (src/sim/skills).
export type SkillEffect =
  | { kind: 'nova'; damage: number; radius: number; knockback: number }
  | { kind: 'dash'; distance: number; invulnerableTicks: number; tauntRadius?: number }
  | { kind: 'healPulse'; amount: number; radius: number; coreRepair: number }
  | FullSkillEffect;

export type ZoneCadence = 'beat' | 'offbeat' | 'continuous';

// A zone a skill or an attack lays on the floor (src/sim/zones.ts). On its cadence it hurts, pushes
// back and heals what stands on it; it slows and pulls on every tick.
export interface ZoneDefinition {
  // A player's zones of one id count towards `maxPerPlayer`: the oldest goes out to make room.
  id: string;
  radius: number;
  // A line this long along the direction it is laid in, `radius` on each side. Absent, a disc.
  length?: number;
  durationBars: number;
  maxPerPlayer: number;
  cadence: ZoneCadence;
  damage?: number;
  knockback?: number;
  // Speed of the bad vibes on it, bosses included.
  slowFactor?: number;
  // The bad vibes on it walk to its centre instead of their target; never a boss.
  pull?: boolean;
  // To each standing player on it.
  heal?: number;
  // Dealt to the bad vibes on it when its time runs out.
  closeDamage?: number;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  cooldownTicks: number;
  effect: SkillEffect;
}

// A class gauge (Élan, Kiff, Racines...): the module of its kind in `GAUGES` (src/sim/systems/gauges.ts)
// fills and drains it, the HUD shows it as a ring under its name.
export interface GaugeDefinition {
  kind: string;
  name: string;
  // Its full value: 1 for a gauge that fills smoothly, its count of notches for one read by steps.
  max: number;
  // Where it starts; absent, empty.
  start?: number;
}

// A bad vibe of the horde a player of this class chases joins their side for `bars` bars
// (src/sim/recruits.ts): it rushes the closest bad vibe and shoves it on each beat.
export interface RecruitDefinition {
  bars: number;
  // Recruits a player keeps at once: the oldest leaves for a new one.
  max: number;
  // Dealt on each beat to the bad vibe it touches.
  damage: number;
  speed: number;
  knockback: number;
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
  // Shades the players within, from the sun of the Canicule: the parasol of the Hygie.
  shadeRadius?: number;
  reviveMul?: number;
  attack: AttackDefinition;
  skill: SkillDefinition;
  gauge?: GaugeDefinition;
  recruits?: RecruitDefinition;
  // Weapons drawn as often for this class as for the one of their `classAffinity`.
  affinityWeaponIds?: readonly string[];
  // Weapons never drawn for this class.
  excludedWeaponIds?: readonly string[];
}

export type EnemyBehaviour = 'rusher' | 'horde' | 'heavy' | 'shooter' | 'boss';

export type SpecialEffect =
  | { kind: 'shove'; knockback: number }
  | { kind: 'bottle'; slowFactor: number; durationTicks: number }
  | { kind: 'cling'; slowFactor: number; detachDamage: number }
  | { kind: 'suppress'; radius: number }
  | { kind: 'steal'; fleeSpeedMul: number }
  | { kind: 'yawn'; radius: number; slowFactor: number; awakeBars: number; sleepBars: number }
  | { kind: 'revive'; times: number; hpRatio: number; downBars: number }
  | { kind: 'dazzle'; radius: number }
  | { kind: 'babble'; everyBars: number }
  | { kind: 'frontGuard'; frontDamageMul: number }
  | FullSpecialEffect;

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
  | {
      kind: 'beam';
      damagePerTick: number;
      length: number;
      width: number;
      // The arc swept around the placed direction, two beats out and two back; absent, it stays put.
      sweepDegrees?: number;
    }
  | { kind: 'mist'; slowFactor: number; healPerBar: number; radius: number }
  | { kind: 'lure'; radius: number; markedDamageMul: number }
  | { kind: 'strobe'; stunTicks: number; radius: number }
  | {
      kind: 'breeze';
      slowFactor: number;
      healPerBeat: number;
      // The cone of mist blown from the trap: its length, its opening, and the arc it sweeps
      // around the placed direction, one bar out and one bar back.
      length: number;
      coneDegrees: number;
      sweepDegrees: number;
    };

export interface TrapDefinition {
  id: string;
  name: string;
  description: string;
  radius: number;
  cadence: TrapCadence;
  effect: TrapEffect;
  // Shades the players within, from the sun of the Canicule.
  shade?: number;
  // Odds of this trap in a loot against the other traps, the same for every class.
  lootWeight: number;
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
  | {
      kind: 'trail';
      speedMul: number;
      slowFactor: number;
      healPerBar: number;
      lengthTicks: number;
      // How long the way of each dash stays on the ground, slowing and healing as the trail does.
      dashTrailTicks?: number;
    }
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
  // Its zones shade the players within, from the sun of the Canicule.
  shade?: number;
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

// Plugging a speaker starts a shower of `bars` bars: every plugged speaker lobs `dropsPerBar` vibes
// a bar, each worth `amount`, landing within `radius` of the core after `flightBeats` beats.
export interface VibeRainRules {
  bars: number;
  dropsPerBar: number;
  amount: number;
  radius: number;
  flightBeats: number;
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

// The force of the boss of a tier's drop, whichever the drop draws: the boss brings its shape, size,
// speed and effect, and its own maxHp, damage and vibesDrop serve nowhere else.
export interface BossStrength {
  maxHp: number;
  damage: number;
  vibesDrop: number;
}

export interface TierDefinition {
  buildupPhrases: number;
  breakBars: number;
  boss: BossStrength;
  spawns: readonly SpawnRule[];
  // Read during the drop, bars counted from its start. Absent means the boss comes alone.
  dropSpawns?: readonly SpawnRule[];
  bystanderSpawns?: readonly BystanderSpawnRule[];
}

// Every `everyBars` bars, the next bad vibe to spawn carries a loot; killed, it drops it.
export interface LootRules {
  everyBars: number;
  lifetimeBars: number;
  radius: number;
  // The trap of the first loot of the game.
  first: string;
}

// Every `everyBars` bars, the next bad vibe to spawn carries a bomb; killed, it drops it, and a
// player stepping on it clears the floor of every bad vibe but the bosses.
export interface BombRules {
  everyBars: number;
  lifetimeBars: number;
  radius: number;
}

// How a stage is drawn.
// The look of a stage: its ground, its decor and its card. `lake` is the main stage's.
export type DecorId = string;

// A round obstacle of the stage: it blocks players, bad vibes and shots.
export interface ObstacleDefinition {
  x: number;
  y: number;
  radius: number;
}

export interface SetDefinition {
  id: string;
  name: string;
  // The music style shown on the stage's card. Absent means none.
  style?: string;
  // Length of the stage's beat in ticks, the tick rate staying the same (ADR 0012). Absent means 12.
  ticksPerBeat?: number;
  decor: DecorId;
  obstacles?: readonly ObstacleDefinition[];
  // The tracks this stage draws from.
  trackIds: readonly string[];
  // The stage's room reverb. Absent means a dry stage. `lowCutHz` keeps the lows out of the room,
  // `toneHz` darkens its tail.
  acoustics?: { reverbSeconds: number; wet: number; lowCutHz?: number; toneHz?: number };
  arena: { width: number; height: number };
  core: { radius: number; maxHp: number };
  // Traps a player carries at most, and those each player starts the game with.
  handSize: number;
  startingHand: readonly string[];
  // Absent means no loot.
  loot?: LootRules;
  // Absent means no bomb.
  bomb?: BombRules;
  maxTraps: number;
  levelCurve: { baseVibes: number; vibesPerLevel: number };
  pickups: { lifetimeTicks: number; speed: number };
  tiers: readonly TierDefinition[];
  speakers?: readonly SpeakerDefinition[];
  // Absent means no shower.
  vibeRain?: VibeRainRules;
  // Absent means 3.
  weaponSlots?: number;
  reviveBars?: number;
  // Most the core can be repaired per bar, all sources together. Absent means no cap.
  coreRepairPerBar?: number;
  perPlayer?: { spawnMul: number; enemyHpMul: number };
  // Endless games: what each minute past the last boss multiplies, on top of each bad vibe's own
  // scaling. Absent, the endless part only replays the last tier.
  endlessPerMinute?: { hp: number; damage: number };
  // Each window of `everyBars` bars comes from one or two sides with `chance`; `randomShare` of its
  // rule spawns still come from anywhere on the edge. Absent means every spawn comes from anywhere.
  sidedWaves?: { everyBars: number; chance: number; randomShare: number };
}

export type EdgeSide = 'top' | 'right' | 'bottom' | 'left';

// A character or a stage of the full game, shown locked in the demo (ADR 0014): its name and colour, never its data.
export interface TeaserDefinition {
  kind: 'class' | 'stage';
  name: string;
  // The music style of a stage.
  style?: string;
  color: string;
}

// The dash every character has, the same for all (docs/game-design.md, « Le dash »).
export interface DashDefinition {
  distance: number;
  ticks: number;
  // A spent dash comes back on the beat that completes this many beats, never fewer than the floor.
  rechargeBeats: number;
  minRechargeBeats: number;
  charges: number;
  maxCharges: number;
  // A dash this many ticks or fewer from a beat goes `onBeatDistanceMul` further.
  onBeatTicks: number;
  onBeatDistanceMul: number;
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
  // Absent, nobody dashes.
  dash?: DashDefinition;
  // The sets a game walks through between two stages (ADR 0018), never offered at the stage choice.
  paths?: readonly SetDefinition[];
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
  | 'laser'
  | 'kalimba'
  | 'choir'
  | 'siren'
  | 'bowl'
  | 'darbouka'
  | 'riq'
  | 'oud'
  | 'ney'
  | 'sub'
  | 'sub-saw'
  | 'skank'
  | 'flute'
  | 'melodica'
  | 'ooh'
  | 'bubble'
  | 'halo'
  | 'mallet'
  | 'glide-sub'
  | 'bansuri'
  | 'bird'
  | 'wind'
  | 'drone'
  | 'felt'
  | 'cello'
  | 'saw-pad'
  | 'sweep-pluck'
  | 'gallop-bass'
  | 'pulse'
  | 'chant';

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
  // Absent: in and out of the break. `light`: only in the break, `full`: never in it, `rise`: only
  // in the buildup, `drop`: only in the drop.
  in?: 'full' | 'light' | 'rise' | 'drop';
  // Multiplies the voice's level. Absent means 1.
  gain?: number;
  // Steps of the loop whose note is accented, or slides from the previous note.
  accents?: readonly number[];
  slides?: readonly number[];
}

export type DrumVoiceId =
  | 'kick'
  | 'snare'
  | 'rim'
  | 'clap'
  | 'hat'
  | 'hat-open'
  | 'shaker'
  | 'doum'
  | 'tek'
  | 'frame-drum'
  | 'rattle'
  | 'tom'
  | 'udu'
  | 'cabasa'
  | 'tuned-kick'
  | 'bright-hat'
  | 'bright-hat-open'
  | 'big-clap'
  | 'ride'
  | 'sand-shaker'
  | 'wood-rim';

// One drum of a track's own kit: [sixteenth within the loop, gain] hits, gated by its layer.
export interface DrumPart {
  voice: DrumVoiceId;
  layer: MusicLayer;
  loopSteps: number;
  hits: readonly (readonly [step: number, gain: number])[];
  // From -1 (left) to 1 (right). Absent means centred.
  pan?: number;
  // Same meaning as on a music part: the segments in which the drum is heard.
  in?: MusicPart['in'];
  // Pitch of a `tom` or a `tuned-kick`, in Hz.
  hz?: number;
  // Ring of a tom, doum or frame drum, in seconds. Absent keeps the voice's own.
  release?: number;
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
  // Replaces the engine's echo: the feedback of the repeats, their tone in Hz and what returns.
  // `wide` bounces the repeats from left to right.
  echo?: { feedback: number; ret: number; tone: number; wide?: boolean };
  // `soft`: no snare roll before the drop, a low and quiet riser, a gentler fall into the break.
  build?: 'soft';
  // Hz the pad's filter opens by at each bar of the break.
  padOpens?: number;
  parts: readonly MusicPart[];
  // Replaces the engine's kick and hats. Absent means the current kit.
  drums?: readonly DrumPart[];
}

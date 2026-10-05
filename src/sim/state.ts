import type { StatKey } from '../data/types';

export type EntityId = number;
export type PlayerId = 0 | 1 | 2 | 3;

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Positioned {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

export type GameStatus = 'running' | 'choosingUpgrade' | 'won' | 'lost';
export type SetSegment = 'buildup' | 'break' | 'drop';

export interface SetProgress {
  tier: number;
  segment: SetSegment;
  phrase: number;
  bar: number;
  beat: number;
  segmentStartTick: number;
}

export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

export interface Arena {
  width: number;
  height: number;
}

export interface CoreState {
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  watts: number;
}

export interface WeaponSlot {
  id: string;
  level: number;
  // Free for the module that owns this weapon's effect kind.
  phase: number;
  // Ring of x, y pairs written by the trail module, indexed by tick; `phase` counts the filled pairs.
  trail?: number[];
}

export interface PlayerState extends Positioned {
  id: PlayerId;
  classId: string;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  aim: Vec2;
  level: number;
  vibes: number;
  vibesToNextLevel: number;
  attackCooldown: number;
  skillCooldown: number;
  ultimateReady: boolean;
  upgrades: string[];
  modifiers: Partial<Record<StatKey, number>>;
  downed: boolean;
  invulnerableTicks?: number;
  // Levels gained whose offer is not drawn yet. Optional so that states built by hand stay valid.
  pendingLevelUps?: number;
  // Set by a special effect (sigh, cling) and reset to 1 each tick by `specials`.
  slowFactor?: number;
  // Tick at which the current slowFactor effect ends, and the value it keeps posing until then.
  // `specials` re-poses it each tick until it expires, even once the enemy that caused it is gone;
  // the longer of two overlapping effects wins, so they never stack.
  slowFactorExpiresTick?: number;
  slowFactorValue?: number;
  // Set by suppress; statValue returns the base value of every stat while this is positive.
  suppressedTicks?: number;
  // Set by dazzle, decremented by `specials`.
  dazzledTicks?: number;
  weapons?: WeaponSlot[];
  // Fused forms already taken: a recipe serves once per player.
  fused?: string[];
  name?: string;
  reviveTicks?: number;
}

export interface EnemyState extends Positioned {
  id: EntityId;
  kind: string;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  target: 'core' | PlayerId;
  attackCooldown: number;
  slowFactor: number;
  stunTicks: number;
  marked: boolean;
  // Tick from which the mark lapses, whatever put it there (lure, ribbon): the longest wins.
  markedUntilTick?: number;
  isBoss: boolean;
  // Last player whose projectile, trap or skill hit this enemy: credited with the kill.
  lastHitBy?: PlayerId;
  // Zombie: stand-ups left after reaching 0 hp.
  revivesLeft?: number;
  // Zombie: ticks left lying down before it revives.
  downTicks?: number;
  // Fatigué: ticks left awake before it falls asleep; the nap itself is tracked by stunTicks.
  awakeTicks?: number;
  // Arnaqueur: vibes amount stolen from a pickup, dropped where it dies.
  carrying?: number;
  // Arnaqueur: running from players instead of chasing them, while carrying stolen vibes.
  fleeing?: boolean;
  // Arnaqueur: reached the edge with its loot; `deaths` removes it without a kill or a drop.
  escaped?: boolean;
  // Collant: the player it is attached to.
  clingingTo?: PlayerId;
  // Collant: ticks left before it may attach to a player again, after detaching.
  clingCooldown?: number;
  // Collant: hp as of the previous tick's check, to size the latest hit for detaching.
  hpWatermark?: number;
}

export type ProjectileOwner =
  | { kind: 'player'; playerId: PlayerId }
  | { kind: 'enemy'; enemyId: EntityId }
  | { kind: 'trap'; trapId: EntityId }
  | { kind: 'weapon'; playerId: PlayerId; weaponId: string };

export interface ProjectileState extends Positioned {
  id: EntityId;
  owner: ProjectileOwner;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  ticksLeft: number;
  pierceLeft: number;
  // Enemies a piercing projectile already went through, so it hits each one once.
  hitIds?: EntityId[];
  // The diabolo's lobbed arc: a parabola from launch to (toX, toY) over ticksTotal ticks.
  arc?: { toX: number; toY: number; ticksTotal: number };
  // The frisbee flies back to this player instead of expiring.
  returnTo?: PlayerId;
  // Set once the frisbee has turned back: it no longer hurts, it flies to `returnTo` and heals.
  returning?: boolean;
  heal?: number;
}

export interface TrapState extends Positioned {
  id: EntityId;
  kind: string;
  ownerId: PlayerId;
  level: number;
  direction: Vec2;
  hp: number;
  cooldown: number;
}

export interface SpeakerState {
  id: string;
  x: number;
  y: number;
  radius: number;
  plugTicks: number;
  plugged: boolean;
}

export interface PlacedState extends Positioned {
  id: EntityId;
  weaponId: string;
  playerId: PlayerId;
  radius: number;
  ticksLeft: number;
  cooldown: number;
}

export type PickupKind = 'vibes' | 'watts';

export interface PickupState extends Positioned {
  id: EntityId;
  kind: PickupKind;
  amount: number;
  ticksLeft: number;
}

export interface BystanderState extends Positioned {
  id: EntityId;
  kind: string;
  radius: number;
  // Random point halfway to the core, picked once at spawn: where it walks to, then stops.
  targetX: number;
  targetY: number;
  helpTicks: number;
  ticksLeft: number;
}

export interface LaserShowState {
  id: EntityId;
  playerId: PlayerId;
  damagePerTick: number;
  radius: number;
  ticksLeft: number;
}

export interface BarrierState {
  id: EntityId;
  playerId: PlayerId;
  x: number;
  y: number;
  radius: number;
  hp: number;
  ticksLeft: number;
}

export interface UpgradeOffer {
  playerId: PlayerId;
  options: readonly string[];
  // Absent means levelUp.
  kind?: 'levelUp' | 'relic';
}

export interface SimStats {
  kills: number;
  phrasesHeld: number;
  damageDealt: number;
  vibesCollected: number;
  wattsSpent: number;
}

export type SimEvent =
  | { type: 'beat'; beat: number }
  | { type: 'bar'; bar: number }
  | { type: 'phrase'; phrase: number }
  | { type: 'segment'; segment: SetSegment; tier: number }
  | { type: 'enemySpawned'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'enemyHit'; id: EntityId; damage: number; x: number; y: number }
  | {
      type: 'enemyDied';
      id: EntityId;
      kind: string;
      x: number;
      y: number;
      byPlayer: PlayerId | null;
    }
  | { type: 'playerFired'; playerId: PlayerId; x: number; y: number; angle: number }
  | { type: 'playerHit'; playerId: PlayerId; damage: number }
  | { type: 'playerDowned'; playerId: PlayerId }
  | { type: 'playerRevived'; playerId: PlayerId }
  | { type: 'playerReviving'; playerId: PlayerId; byPlayer: PlayerId; progress: number }
  | { type: 'playerHealed'; playerId: PlayerId; amount: number }
  | { type: 'taunted'; playerId: PlayerId; x: number; y: number; radius: number; count: number }
  | { type: 'barrierBroken'; id: EntityId; x: number; y: number }
  | { type: 'skillUsed'; playerId: PlayerId }
  | { type: 'ultimateUsed'; playerId: PlayerId }
  | { type: 'coreHit'; damage: number }
  | { type: 'coreRepaired'; amount: number }
  | { type: 'trapPlaced'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'trapUpgraded'; id: EntityId; kind: string; level: number; x: number; y: number }
  | { type: 'trapFired'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'trapDestroyed'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'pickupCollected'; playerId: PlayerId; kind: PickupKind; amount: number }
  | { type: 'playerShoved'; id: EntityId; kind: string; playerId: PlayerId; x: number; y: number }
  | { type: 'enemyRevived'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'vibesStolen'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'enemyFled'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'enemyShot'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'enemyYawned'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'enemyBabbled'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'bystanderSpawned'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'bystanderHelped'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'bystanderLost'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'levelUp'; playerId: PlayerId; level: number }
  | { type: 'upgradeChosen'; playerId: PlayerId; upgradeId: string }
  | { type: 'weaponGained'; playerId: PlayerId; weaponId: string }
  // dx, dy: unit direction of the shot (towards the closest bad vibe, or along the aim).
  | {
      type: 'weaponFired';
      playerId: PlayerId;
      weaponId: string;
      x: number;
      y: number;
      dx?: number;
      dy?: number;
    }
  | { type: 'weaponEvolved'; playerId: PlayerId; weaponId: string; resultId: string }
  | { type: 'placedSpawned'; id: EntityId; weaponId: string; x: number; y: number }
  | { type: 'placedRemoved'; id: EntityId; weaponId: string; x: number; y: number }
  | { type: 'speakerPlugging'; speakerId: string; progress: number }
  | { type: 'speakerPlugged'; speakerId: string }
  | { type: 'volumeChanged'; volume: number }
  | { type: 'relicOffered'; playerId: PlayerId; options: readonly string[] }
  | { type: 'gameWon' }
  | { type: 'gameLost' };

export interface SimState {
  seed: number;
  setId: string;
  tick: number;
  status: GameStatus;
  rng: RngState;
  arena: Arena;
  set: SetProgress;
  core: CoreState;
  players: PlayerState[];
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  traps: TrapState[];
  pickups: PickupState[];
  // Optional so that states built by hand before these effects existed stay valid.
  laserShows?: LaserShowState[];
  barriers?: BarrierState[];
  // Optional: created only once a Festivalier en détresse spawns, so the replay fingerprint of a
  // game without one stays unchanged.
  bystanders?: BystanderState[];
  volume?: number;
  speakers?: SpeakerState[];
  placed?: PlacedState[];
  pendingUpgrades: UpgradeOffer[];
  nextEntityId: EntityId;
  stats: SimStats;
  events: SimEvent[];
}

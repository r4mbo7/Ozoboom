import type { EdgeSide, Rarity, StatKey, SummonLook, ZoneDefinition } from '../data/types';
import type { Emote } from './commands';

export type { EdgeSide };

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
  // Endless games only: the tick at which the last boss first fell and its tier started over, null
  // until then.
  endlessFromTick?: number | null;
  // The tick this set started at, the origin of its beats, bars and phrases (ADR 0018). Absent means 0.
  startTick?: number;
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
  // Repaired so far in the current bar: present only under `SetDefinition.coreRepairPerBar`, once something was repaired.
  repairedThisBar?: number;
}

export interface WeaponSlot {
  id: string;
  level: number;
  // Free for the module that owns this weapon's effect kind.
  phase: number;
  // Ring of x, y pairs written by the trail module, indexed by tick; `phase` counts the filled pairs.
  trail?: number[];
  // x, y and the tick it fades at, for each point a dash went through; oldest first.
  dashTrail?: number[];
  // A weapon fired faster than its rhythm (`weaponRateMul`): the share of a shot it has gathered,
  // and the tick its next ghost shot slips in, on a sixteenth its rhythm leaves free.
  ghostShare?: number;
  ghostTick?: number;
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
  // Ticks of charge of a charged attack, held or let go and waiting for the cooldown; absent
  // otherwise. Bounded by the full charge.
  chargeTicks?: number;
  skillCooldown: number;
  upgrades: string[];
  // The rarity of each stack in `upgrades`, same order; absent means all common.
  upgradeRarities?: Rarity[];
  modifiers: Partial<Record<StatKey, number>>;
  downed: boolean;
  invulnerableTicks?: number;
  // Levels gained whose offer is not drawn yet. Optional so that states built by hand stay valid.
  pendingLevelUps?: number;
  // Set by a special effect (bottle, cling) and reset to 1 each tick by `specials`.
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
  // Ticks left in the sun of the Canicule (src/sim/full/heat.ts): they smoke meanwhile.
  sunTicks?: number;
  // Timed stat bonuses posed through `applyPlayerBoost`; absent while it carries none.
  boosts?: PlayerBoost[];
  weapons?: WeaponSlot[];
  // Trap ids carried, oldest first, at most `SetDefinition.handSize`.
  hand?: string[];
  // Fused forms already taken: a recipe serves once per player.
  fused?: string[];
  name?: string;
  reviveTicks?: number;
  // Only on a player whose class has a gauge; read through `gaugeValue`, written through `setGauge`.
  gauge?: number;
  // Online, the player's peer has left: the player stays where they are, and a festival goes on without them.
  gone?: true;
  // Dashes spent and not back yet, and the beats counted toward the next; absent while all are in.
  dashesSpent?: number;
  dashBeats?: number;
  // The move of each tick of a dash under way, and its ticks left; absent outside a dash.
  dash?: { dx: number; dy: number; ticksLeft: number };
  // A light offering held in a trap hand, alone at a stage with a fire or giants: the source of the
  // stage it was taken from; absent otherwise.
  offering?: number;
  // The end of a heavy offering this player holds; absent otherwise.
  carrying?: { logId: EntityId; end: 0 | 1 };
}

// The maximum hp is left out: a bonus that ends never takes hp points away.
export type BoostStat = Exclude<StatKey, 'maxHpAdd'>;

export interface BoostModifier {
  stat: BoostStat;
  add?: number;
  mul?: number;
}

// A timed stat bonus a character poses on a player, itself or an ally (src/sim/player-boosts.ts).
export interface PlayerBoost {
  id: string;
  modifiers: readonly BoostModifier[];
  ticksLeft: number;
}

// Timed statuses a character poses on a bad vibe through `applyEnemyStatus` (src/sim/enemy-status.ts).
export type EnemyStatusKind =
  'slowed' | 'halfTime' | 'disoriented' | 'bubbled' | 'eating' | 'held' | 'frozen';

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
  // Ticks left of each timed status it carries; absent while it carries none.
  statuses?: Partial<Record<EnemyStatusKind, number>>;
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
  // Carries a loot it drops when it dies.
  carriesLoot?: boolean;
  // Carries a bomb it drops when it dies.
  carriesBomb?: boolean;
  // A boss a fire or a giant called into the drop.
  called?: true;
  // Mâle alpha: its last step, which faces the hits it takes at `damageMul`.
  front?: { x: number; y: number; damageMul: number };
  // Larsen: the hits it takes at `damageMul` while its window is shut; its special opens it on the
  // one and the three of every bar.
  armor?: { damageMul: number; open: boolean };
  // Pogo: the heading of his ring, a unit vector turned a notch every tick.
  ring?: { x: number; y: number };
  // A member of the ring of boss `id`, at place `slot` of it, `orbit` pixels from him.
  ringOf?: { id: EntityId; slot: number; orbit: number };
  // Moustiques: the target where a player stood, with the trail flying to it, from its start to
  // its return; `gorged` once it stung someone. Absent between two.
  sting?: {
    x: number;
    y: number;
    startTick: number;
    landTick: number;
    endTick: number;
    gorged?: true;
  };
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
  // Distance an enemy it hits is pushed away from it.
  knockback?: number;
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
  direction: Vec2;
  // Ticks left shorted by a puddle (src/sim/puddles.ts): it fires no more meanwhile, as
  // `suppressedTicks` holds a player.
  shortedTicks?: number;
}

// A puddle a bad vibe laid (src/sim/puddles.ts), wet until `driesTick`.
export interface PuddleState {
  id: EntityId;
  byId: EntityId;
  x: number;
  y: number;
  radius: number;
  bornTick: number;
  driesTick: number;
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

// A wall a player raised (src/sim/walls.ts): a segment across `normal`, no bad vibe crosses it, a boss
// only slows down there.
export interface WallState {
  id: EntityId;
  playerId: PlayerId;
  x: number;
  y: number;
  normal: Vec2;
  halfLength: number;
  ticksLeft: number;
}

// A zone a skill or an attack laid (src/sim/zones.ts).
export interface ZoneState {
  id: EntityId;
  playerId: PlayerId;
  definition: ZoneDefinition;
  x: number;
  y: number;
  // Unit vector along a line zone: the way it was laid.
  direction: Vec2;
  // Multiplies its damage and its heal.
  power: number;
  // Its definition's, unless the skill that laid it grew it (`skillRadiusMul`).
  radius: number;
  ticksLeft: number;
}

// A bad vibe of the horde a player recruited (src/sim/recruits.ts), under the id it had as a bad vibe.
export interface RecruitState extends Positioned {
  id: EntityId;
  playerId: PlayerId;
  kind: string;
  radius: number;
  ticksLeft: number;
}

// Where a prop is: in its owner's hands, flying where it was thrown, bouncing from bad vibe to bad
// vibe, lying on the ground, or flying back to its owner.
export type PropPhase = 'held' | 'flying' | 'bouncing' | 'grounded' | 'returning';

// What a character throws, the Jongleur's clubs, the Sportif's ball, the Tatoué's dragons, the Super
// fan's glowsticks: the modules of its attack and skill move it, the render draws it by `kind`.
export interface PropState extends Positioned {
  id: EntityId;
  kind: string;
  playerId: PlayerId;
  phase: PropPhase;
  vx: number;
  vy: number;
  damage: number;
  // Ticks left in its phase: before it falls, before it flies back on its own.
  ticksLeft: number;
  // Bad vibes it may still hit in its phase, each once.
  hitsLeft: number;
  hitIds?: EntityId[];
  // The bad vibe it bounces to.
  targetId?: EntityId;
  // Hits harder: a club caught on the beat until thrown, a ball kicked at full Élan.
  boosted?: true;
  // Its rank among the ones its owner let out: a dragon of the Tatoué takes its lane and its
  // colour from it, a glowstick of the Super fan, the beat it left on, its hand and how far it flies.
  rank?: number;
}

export type PickupKind = 'vibes';

export interface PickupState extends Positioned {
  id: EntityId;
  kind: PickupKind;
  amount: number;
  ticksLeft: number;
  // Lobbed by a speaker and not landed yet: `x`, `y` is where it lands, nobody can take it.
  flight?: { ticksLeft: number; ticks: number; fromX: number; fromY: number };
}

// A gust: its direction, a unit vector, the tick its warning began, the tick it blows from, the
// tick it ends, and how far it drifts what is light a tick at full blow.
export interface GustState {
  x: number;
  y: number;
  warnTick: number;
  blowTick: number;
  endTick: number;
  push: number;
}

export interface LootState extends Positioned {
  id: EntityId;
  trapId: string;
  ticksLeft: number;
}

export interface BombState extends Positioned {
  id: EntityId;
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

export type FestivalPhase = 'scene' | 'sunrise' | 'path';

// An exit open at sunrise, toward a stage still to play: a disc on the edge `side`.
export interface FestivalExit {
  setId: string;
  side: EdgeSide;
  x: number;
  y: number;
  radius: number;
}

// A Full festival game (src/sim/full/festival.ts).
export interface FestivalState {
  phase: FestivalPhase;
  // Each stage played, in order, the tick it started at and, once held, the tick of its sunrise.
  scenes: { setId: string; fromTick: number; toTick?: number }[];
  // At sunrise, one exit per stage still to play.
  exits: FestivalExit[];
  // The index in `exits` each player stands in, same order as `players`, null outside any.
  standing: (number | null)[];
  // Ticks the whole team has stood in the same exit.
  departTicks: number;
  // The exit taken, from leaving until the next stage starts.
  taken?: FestivalExit;
}

export interface UpgradeOffer {
  playerId: PlayerId;
  options: readonly string[];
  // The rarity of each option, same order, common for weapons and relics.
  rarities: readonly Rarity[];
  // Absent means levelUp.
  kind?: 'levelUp' | 'relic';
}

export interface SimStats {
  kills: number;
  phrasesHeld: number;
  damageDealt: number;
  vibesCollected: number;
  // Called bosses down; absent until the first.
  calledDown?: number;
}

// A heavy offering (a log, a giant mushroom cap) lying or carried by two: its centre, and the unit
// axis from the centre to its end 0.
export interface HeavyOfferingState extends Positioned {
  id: EntityId;
  ax: number;
  ay: number;
  // Who holds each end.
  ends: [PlayerId | null, PlayerId | null];
  // The site it touched: it falls in on the next bar.
  site?: number;
}

// What a team brought to the fire or the giants of the stage it plays (`setId`).
export interface SummonState {
  setId: string;
  // Offerings taken from each source, and burnt at each site.
  taken: number[];
  burnt: number[];
  // The sites in the order they took their offerings: the n-th called boss comes through the n-th.
  order: number[];
  // The site of each light offering thrown in, burning on the next bar.
  falling: number[];
  heavy: HeavyOfferingState[];
  // The bosses called into the current drop.
  called: string[];
}

export type SimEvent =
  | { type: 'beat'; beat: number }
  | { type: 'bar'; bar: number }
  | { type: 'phrase'; phrase: number }
  // The gust of the Coup de vent begins to blow toward (x, y), a unit vector.
  | { type: 'gust'; x: number; y: number }
  // The trail of the Moustiques stings a player standing in its target.
  | { type: 'stung'; playerId: PlayerId; x: number; y: number }
  | { type: 'segment'; segment: SetSegment; tier: number }
  | { type: 'enemySpawned'; id: EntityId; kind: string; x: number; y: number }
  | {
      type: 'enemyHit';
      id: EntityId;
      damage: number;
      x: number;
      y: number;
      front?: true;
      // Scaled down by an armor shut between its windows: the Larsen's.
      armored?: true;
      // The player credited with the hit and where it came from, when the sim knows them.
      by?: PlayerId;
      fromX?: number;
      fromY?: number;
    }
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
  | { type: 'skillUsed'; playerId: PlayerId }
  | { type: 'dashed'; playerId: PlayerId; dx: number; dy: number; onBeat?: true }
  | { type: 'dashEmpty'; playerId: PlayerId }
  | { type: 'dashBack'; playerId: PlayerId }
  | { type: 'emoted'; playerId: PlayerId; emote: Emote }
  | { type: 'coreHit'; damage: number }
  | { type: 'coreRepaired'; amount: number }
  | { type: 'trapPlaced'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'trapFired'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'trapTaken'; id: EntityId; kind: string; playerId: PlayerId; x: number; y: number }
  | { type: 'pickupCollected'; playerId: PlayerId; kind: PickupKind; amount: number }
  | { type: 'lootDropped'; id: EntityId; trapId: string; x: number; y: number }
  | {
      type: 'lootCollected';
      id: EntityId;
      playerId: PlayerId;
      trapId: string;
      x: number;
      y: number;
    }
  | { type: 'bombDropped'; id: EntityId; x: number; y: number }
  | { type: 'bombExploded'; id: EntityId; playerId: PlayerId; x: number; y: number }
  | { type: 'playerShoved'; id: EntityId; kind: string; playerId: PlayerId; x: number; y: number }
  | { type: 'enemyStatusStarted'; id: EntityId; status: EnemyStatusKind; x: number; y: number }
  | { type: 'enemyStatusEnded'; id: EntityId; status: EnemyStatusKind; x: number; y: number }
  | { type: 'playerBoostStarted'; playerId: PlayerId; boost: string }
  | { type: 'playerBoostEnded'; playerId: PlayerId; boost: string }
  | { type: 'recruited'; id: EntityId; kind: string; playerId: PlayerId; x: number; y: number }
  | { type: 'recruitLeft'; id: EntityId; playerId: PlayerId; x: number; y: number }
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
  // A body of a weapon touched a bad vibe. A continuous weapon (the fans) fires every tick, so this is its only meaningful moment.
  | { type: 'weaponHit'; playerId: PlayerId; weaponId: string; id: EntityId; x: number; y: number }
  | { type: 'weaponEvolved'; playerId: PlayerId; weaponId: string; resultId: string }
  | { type: 'placedSpawned'; id: EntityId; weaponId: string; x: number; y: number }
  | { type: 'placedRemoved'; id: EntityId; weaponId: string; x: number; y: number }
  | { type: 'zoneLaid'; id: EntityId; zoneId: string; playerId: PlayerId; x: number; y: number }
  | { type: 'zoneEnded'; id: EntityId; zoneId: string; x: number; y: number }
  | { type: 'speakerPlugging'; speakerId: string; progress: number }
  | { type: 'speakerPlugged'; speakerId: string }
  | { type: 'volumeChanged'; volume: number }
  | { type: 'relicOffered'; playerId: PlayerId; options: readonly string[] }
  | { type: 'offeringTaken'; playerId: PlayerId; x: number; y: number; heavy: boolean }
  | { type: 'offeringThrown'; playerId: PlayerId; site: number; x: number; y: number }
  | { type: 'heavyGrabbed'; id: EntityId; playerId: PlayerId }
  | { type: 'heavyDropped'; id: EntityId; playerId: PlayerId }
  // An offering fell in on the 1: `burnt` at this site, `total` at the stage.
  | {
      type: 'offeringBurnt';
      look: SummonLook;
      site: number;
      burnt: number;
      total: number;
      x: number;
      y: number;
    }
  | { type: 'bossCalled'; id: EntityId; kind: string; site: number; x: number; y: number }
  | { type: 'festivalSceneHeld'; setId: string }
  | { type: 'festivalLeft'; setId: string; side: EdgeSide }
  | { type: 'festivalArrived'; setId: string }
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
  // Optional: created only once a Festivalier en détresse spawns, so the replay fingerprint of a
  // game without one stays unchanged.
  bystanders?: BystanderState[];
  // Optional, like `bystanders`: created with the first loot carrier of a set that has loot.
  loots?: LootState[];
  // Loots dropped so far: the first one holds `LootRules.first`.
  lootsDropped?: number;
  // The bar a loot falls due next, then whether no bad vibe carries it yet.
  nextLootBar?: number;
  lootDue?: boolean;
  // Optional like `loots`, and created with the first bomb dropped.
  bombs?: BombState[];
  // The bar a bomb falls due next, then whether no bad vibe carries it yet.
  nextBombBar?: number;
  bombDue?: boolean;
  volume?: number;
  speakers?: SpeakerState[];
  // Ticks left of the shower of `SetDefinition.vibeRain`.
  vibeRainTicks?: number;
  placed?: PlacedState[];
  // Optional like `bystanders`: created with the first wall raised, removed when the last one falls.
  walls?: WallState[];
  // Optional like `walls`: created with the first zone laid, removed when the last one goes out.
  zones?: ZoneState[];
  // Optional like `walls`: created with the first recruit, removed when the last one leaves.
  recruits?: RecruitState[];
  // Optional like `walls`: created with the first puddle laid, removed when the last one dries.
  puddles?: PuddleState[];
  // The gust of the Coup de vent, from its warning to its end; absent between two.
  gust?: GustState;
  // Optional like `bystanders`: created with the first prop of a character who throws them.
  props?: PropState[];
  // The sides of the current window of `SetDefinition.sidedWaves`, drawn at its first rule spawn;
  // no sides means a window from anywhere.
  spawnWindow?: { index: number; sides: EdgeSide[] };
  // The bosses drawn so far, one as each break starts: the last one is the boss of the coming or
  // current drop. Created with the first draw.
  bosses?: string[];
  // Full game: what the team brought to the fire or the giants, created with the first offering taken.
  summon?: SummonState;
  // Bosses still to come in the current drop: the drop goes on until none is left.
  bossesDue?: number;
  // What the bad vibes gain on top of their own scaling, at spawn: absent means none.
  enemyScale?: { hp: number; damage: number };
  // Full festival games only.
  festival?: FestivalState;
  pendingUpgrades: UpgradeOffer[];
  nextEntityId: EntityId;
  stats: SimStats;
  events: SimEvent[];
}

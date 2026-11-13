import type {
  EdgeSide,
  TrapDraw,
  Rarity,
  StatKey,
  SummonLook,
  ZoneDefinition,
} from '../data/types';
import type { Emote } from './commands';

export type { EdgeSide };

export type EntityId = number;
export const PLAYER_IDS = [0, 1, 2, 3] as const;

// Marks of different sources multiply the damage a bad vibe takes; one source keeps its strongest.
export type MarkSource = 'lure' | 'ribbon' | 'mapping';

export interface EnemyMark {
  damageMul: number;
  untilTick: number;
}
export type PlayerId = (typeof PLAYER_IDS)[number];

export function playerIdAt(index: number): PlayerId {
  const id = PLAYER_IDS[index];
  if (id === undefined) {
    throw new RangeError(`no player at seat ${String(index)}`);
  }
  return id;
}

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
  // The tick the last boss first fell and its tier started over; null until then.
  endlessFromTick?: number | null;
  // The origin of its beats, bars and phrases (ADR 0018); absent means 0.
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
  // Present only under `SetDefinition.coreRepairPerBar`, once something was repaired.
  repairedThisBar?: number;
}

export interface WeaponSlot {
  id: string;
  level: number;
  // Free for the module that owns this weapon's effect kind.
  phase: number;
  // A ring of x, y pairs indexed by tick; `phase` counts the filled pairs.
  trail?: number[];
  // x, y and the tick it fades at, for each point a dash went through, oldest first.
  dashTrail?: number[];
  // Fired faster than its rhythm (`weaponRateMul`): the share of a shot gathered, and when it slips in.
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
  // Held, or let go and waiting for the cooldown; bounded by the full charge.
  chargeTicks?: number;
  skillCooldown: number;
  upgrades: string[];
  // Same order as `upgrades`; absent means all common.
  upgradeRarities?: Rarity[];
  modifiers: Partial<Record<StatKey, number>>;
  downed: boolean;
  invulnerableTicks?: number;
  // Levels whose offer is not drawn yet; optional so that states built by hand stay valid.
  pendingLevelUps?: number;
  // Posed by a special (bottle, cling), reset to 1 each tick by `specials`.
  slowFactor?: number;
  // `specials` re-poses the slow until then, its cause gone or not; the longer of two wins, never both.
  slowFactorExpiresTick?: number;
  slowFactorValue?: number;
  // While positive, statValue returns the base value of every stat.
  suppressedTicks?: number;
  dazzledTicks?: number;
  // In the Canicule's sun: the player smokes meanwhile.
  sunTicks?: number;
  boosts?: PlayerBoost[];
  weapons?: WeaponSlot[];
  // Above the head, where it does not act.
  carriedTrap?: CarriedTrap;
  // Under it, the others a class that carries several holds, the last taken on top.
  carriedUnder?: CarriedTrap[];
  // Put down while it still carries another: the key takes none of them back until it carries none.
  laidTrapIds?: EntityId[];
  // The Rallonge plugged into one trap, from `tick` on, until it has let go.
  rechargePlug?: { trapId: EntityId; tick: number };
  // A recipe serves once per player.
  fused?: string[];
  name?: string;
  reviveTicks?: number;
  // Read through `gaugeValue`, written through `setGauge`.
  gauge?: number;
  // The Circadien's clock since his last Éclipse (src/sim/full/clock.ts); absent before his first.
  clock?: { night: boolean; fromTick: number };
  // Online, their peer has left: the player stays put, and a festival goes on without them.
  gone?: true;
  // Absent while all dashes are in.
  dashesSpent?: number;
  dashBeats?: number;
  // The move of each tick of a dash under way.
  dash?: { dx: number; dy: number; ticksLeft: number };
  // The source of the light offering held.
  offering?: number;
  // Absent until their first feat.
  tally?: PlayerTally;
  // Rerolls of an offer in reserve, one per die picked up; absent, none.
  rerolls?: number;
  carrying?: { logId: EntityId; end: 0 | 1 };
  // x, y pairs from the newest, as long as the Poussin's band in file behind him.
  steps?: number[];
}

// The maximum hp is left out: a bonus that ends never takes hp points away.
export type BoostStat = Exclude<StatKey, 'maxHpAdd'>;

export interface BoostModifier {
  stat: BoostStat;
  add?: number;
  mul?: number;
}

export interface PlayerBoost {
  id: string;
  modifiers: readonly BoostModifier[];
  ticksLeft: number;
}

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
  // Ticks left of each.
  statuses?: Partial<Record<EnemyStatusKind, number>>;
  // Absent unmarked.
  marks?: Partial<Record<MarkSource, EnemyMark>>;
  isBoss: boolean;
  // Credited with the kill.
  lastHitBy?: PlayerId;
  // Zombie: stand-ups left after reaching 0 hp.
  revivesLeft?: number;
  // Zombie: ticks left lying down before it revives.
  downTicks?: number;
  // Fatigué: ticks before it falls asleep; the nap itself is stunTicks.
  awakeTicks?: number;
  // Arnaqueur: vibes stolen from a pickup, dropped where it dies.
  carrying?: number;
  // Arnaqueur: running from players while carrying stolen vibes.
  fleeing?: boolean;
  // Arnaqueur: reached the edge with what it stole; `deaths` removes it without a kill or a drop.
  escaped?: boolean;
  // Collant: the player it holds on to.
  clingingTo?: PlayerId;
  // Collant: ticks before it may attach again.
  clingCooldown?: number;
  // Collant: hp at the previous tick's check, to size the latest hit for detaching.
  hpWatermark?: number;
  // The trap drawn when it entered, dropped already placed where it dies.
  carriesTrap?: string;
  carriesBomb?: boolean;
  carriesTwinVibes?: true;
  // Called into the drop by a fire or a giant.
  called?: true;
  // Mâle alpha: its last step; the hits it faces count `damageMul`.
  front?: { x: number; y: number; damageMul: number };
  // Larsen: the hits it takes count `damageMul` while its window is shut.
  armor?: { damageMul: number; open: boolean };
  // Pogo: the heading of his ring, a unit vector.
  ring?: { x: number; y: number };
  // At place `slot` of the ring of boss `id`, `orbit` pixels from him.
  ringOf?: { id: EntityId; slot: number; orbit: number };
  // Thrown by the Bénévole's grabber: it flies from `from` to `to`, over everything, and acts not
  // meanwhile; where it lands it takes `damage`, those within `fallRadius` take `fall`, and it
  // bounces on `bounces` times, `bounce` further along the unit `way` each.
  tossed?: {
    by: PlayerId;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    wayX: number;
    wayY: number;
    startTick: number;
    landTick: number;
    damage: number;
    fall: number;
    fallRadius: number;
    bounces: number;
    bounce: number;
  };
  // Moustiques: the target and its trail, from its start to its return; absent between two.
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
  // Distance an enemy it hits is pushed away.
  knockback?: number;
  // So that a piercing projectile hits each enemy once.
  hitIds?: EntityId[];
  // The diabolo's lob: a parabola to (toX, toY) over ticksTotal ticks.
  arc?: { toX: number; toY: number; ticksTotal: number };
  // The frisbee flies back to this player instead of expiring.
  returnTo?: PlayerId;
  // It no longer hurts: it flies to `returnTo` and heals.
  returning?: boolean;
  heal?: number;
}

// What a trap keeps from the ground to above a player's head and back.
export interface CarriedTrap {
  id: EntityId;
  kind: string;
  // From 1 fresh down to 0, where it goes out (src/sim/trap-wear.ts).
  intensity: number;
  // When a Rallonge last recharged it: once every `TrapWear.rechargeEveryBars` at most.
  rechargedTick?: number;
}

export interface TrapState extends Positioned, CarriedTrap {
  // The last player who put it down, whose cards it fires with; the killer of its carrier before.
  ownerId: PlayerId;
  direction: Vec2;
  // Shorted by a puddle: it fires no more meanwhile.
  shortedTicks?: number;
}

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

// No bad vibe crosses it; a boss only slows down there.
// A circle around where it was raised, grown by `grow` a tick up to `reach`.
export interface WallState {
  id: EntityId;
  playerId: PlayerId;
  x: number;
  y: number;
  radius: number;
  reach: number;
  grow: number;
  ticksLeft: number;
  // On each beat, to every bad vibe it holds out and every boss it slows.
  damage?: number;
  // Over the first half of each beat, how far it pushes out every boss on its edge.
  bossPush?: number;
}

export interface ZoneState {
  id: EntityId;
  playerId: PlayerId;
  definition: ZoneDefinition;
  x: number;
  y: number;
  // Along a line zone: the way it was laid.
  direction: Vec2;
  // Multiplies its damage and its heal.
  power: number;
  // Its definition's, unless `skillRadiusMul` grew it.
  radius: number;
  ticksLeft: number;
}

// Under the id it had as a bad vibe.
export interface RecruitState extends Positioned {
  id: EntityId;
  playerId: PlayerId;
  kind: string;
  radius: number;
  ticksLeft: number;
}

export type PropPhase = 'held' | 'flying' | 'bouncing' | 'grounded' | 'returning';

export interface PropState extends Positioned {
  id: EntityId;
  kind: string;
  playerId: PlayerId;
  phase: PropPhase;
  vx: number;
  vy: number;
  damage: number;
  // In its phase: before it falls, or flies back on its own.
  ticksLeft: number;
  // In its phase, each bad vibe once; a dragon, the obstacles it still flies through.
  hitsLeft: number;
  hitIds?: EntityId[];
  targetId?: EntityId;
  // A club caught on the beat until thrown, a ball kicked at full Élan.
  boosted?: true;
  // Among those its owner let out: a dragon's lane and colour, a glowstick's beat, hand and reach.
  rank?: number;
}

export type PickupKind = 'vibes';

export interface PickupState extends Positioned {
  id: EntityId;
  kind: PickupKind;
  amount: number;
  ticksLeft: number;
  // Lobbed by a speaker: `x`, `y` is where it lands, and nobody can take it before.
  flight?: { ticksLeft: number; ticks: number; fromX: number; fromY: number };
  // Swept to this player whatever the distance: the Bénévole's Grand ménage.
  drawnBy?: PlayerId;
}

// Set a bar ahead; it rules from `startTick` to `endTick` excluded, or until `byId` is chased.
export interface BlackoutState {
  byId: EntityId;
  startTick: number;
  endTick: number;
}

// `x`, `y` a unit vector; `push`, the drift of what is light a tick at full blow.
export interface GustState {
  x: number;
  y: number;
  warnTick: number;
  blowTick: number;
  endTick: number;
  push: number;
}

export interface BombState extends Positioned {
  id: EntityId;
  ticksLeft: number;
}

// The stage's vibes jumelles, from due to the end of their doubling; `over` once dropped for good.
export type TwinVibesState =
  | { stage: 'due' }
  | { stage: 'carried' }
  | (Vec2 & { stage: 'lying'; id: EntityId; ticksLeft: number })
  | { stage: 'doubling'; ticksLeft: number }
  | { stage: 'over' };

export interface DieState extends Positioned {
  id: EntityId;
  ticksLeft: number;
}

export interface BystanderState extends Positioned {
  id: EntityId;
  kind: string;
  radius: number;
  // Picked once at spawn, roughly halfway to the core: where it walks to, then stops.
  targetX: number;
  targetY: number;
  helpTicks: number;
  ticksLeft: number;
}

// Compounded on the bad vibes spawned from then on; the optional factors are 1 when missing.
export interface EnemyScale {
  hp: number;
  damage: number;
  // Every bad vibe but the bosses.
  speed?: number;
  count?: number;
  bossHp?: number;
  bossDamage?: number;
}

export type FestivalPhase = 'scene' | 'sunrise' | 'path';

export interface FestivalExit {
  setId: string;
  side: EdgeSide;
  x: number;
  y: number;
  radius: number;
}

// A board of the path: each player lights their pastille by shooting it, and once all are lit
// the stage ahead is harder, and earns more. A new shot at it puts the pastille out.
export interface FestivalChallenge {
  id: string;
  x: number;
  y: number;
  // In `players` order.
  lit: boolean[];
  takenTick?: number;
  // Once a pastille went out on the board taken, until it is taken again.
  droppedTick?: number;
}

export interface FestivalScene {
  setId: string;
  fromTick: number;
  // Once held, the tick of its sunrise.
  toTick?: number;
  // The challenges taken on the way to it, with the `stageGains` at its start and, once over, what it earned.
  challenges?: { ids: string[]; scoreMul: number; scoreFrom: number; earned?: number };
}

export interface FestivalState {
  phase: FestivalPhase;
  // In order.
  scenes: FestivalScene[];
  // At sunrise, one per stage still to play.
  exits: FestivalExit[];
  // The index in `exits` each player stands in, in `players` order; null outside any.
  standing: (number | null)[];
  // Ticks the whole team has stood in the same exit.
  departTicks: number;
  // From leaving until the next stage starts.
  taken?: FestivalExit;
  // On a path, one per challenge.
  challenges?: FestivalChallenge[];
}

export interface UpgradeOffer {
  playerId: PlayerId;
  options: readonly string[];
  // Same order; common for weapons and relics.
  rarities: readonly Rarity[];
  // Absent means levelUp.
  kind?: 'levelUp' | 'relic';
}

// What one player did in the game, for the titles of the end screen.
export interface PlayerTally {
  // Those whose last hit was theirs, bosses included.
  badVibes: number;
  bosses: number;
  // Allies they stood up.
  revives: number;
  vibes: number;
}

export interface SimStats {
  kills: number;
  phrasesHeld: number;
  damageDealt: number;
  vibesCollected: number;
  // Absent until the first.
  calledDown?: number;
}

// Its centre, and the unit axis from the centre to its end 0.
export interface HeavyOfferingState extends Positioned {
  id: EntityId;
  ax: number;
  ay: number;
  ends: [PlayerId | null, PlayerId | null];
  // The site it touched: it falls in on the next bar.
  site?: number;
}

export interface SummonState {
  setId: string;
  // Per source, then per site.
  taken: number[];
  burnt: number[];
  // The sites in the order they took their offerings: the n-th called boss comes through the n-th.
  order: number[];
  // The site of each light offering thrown in, burning on the next bar.
  falling: number[];
  heavy: HeavyOfferingState[];
  // Into the current drop.
  called: string[];
}

export type SimEvent =
  | { type: 'beat'; beat: number }
  | { type: 'bar'; bar: number }
  | { type: 'phrase'; phrase: number }
  // Toward (x, y), a unit vector.
  | { type: 'gust'; x: number; y: number }
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
      // Scaled down by the Larsen's shut armor.
      armored?: true;
      // When the sim knows them.
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
  // The Bénévole's grabber closes on bad vibe `id`; a thrown one lands.
  | { type: 'pinched'; playerId: PlayerId; id: EntityId; x: number; y: number }
  | { type: 'tossLanded'; playerId: PlayerId; id: EntityId; x: number; y: number }
  // The Kiffeur's good mood reached a bad vibe past the rim of his aura.
  | { type: 'moodSpilled'; playerId: PlayerId; id: EntityId; x: number; y: number }
  | { type: 'playerHit'; playerId: PlayerId; damage: number }
  | { type: 'playerDowned'; playerId: PlayerId }
  | { type: 'playerRevived'; playerId: PlayerId }
  | { type: 'playerReviving'; playerId: PlayerId; byPlayer: PlayerId; progress: number }
  | { type: 'playerHealed'; playerId: PlayerId; amount: number }
  | { type: 'taunted'; playerId: PlayerId; x: number; y: number; radius: number; count: number }
  | { type: 'skillUsed'; playerId: PlayerId }
  | { type: 'eclipseBurst'; playerId: PlayerId; x: number; y: number }
  // The Éclat of a bubble of the Somnam’bulle, hurting all within `radius`.
  | { type: 'bubbleBurst'; id: EntityId; playerId: PlayerId; x: number; y: number; radius: number }
  // Déchaîné is cast: `element` is the one of its bar, in the order of the Avatar's cycle.
  | { type: 'unleashed'; playerId: PlayerId; element: number }
  | { type: 'stiltLanded'; playerId: PlayerId }
  | { type: 'dashed'; playerId: PlayerId; dx: number; dy: number; onBeat?: true }
  | { type: 'dashEmpty'; playerId: PlayerId }
  | { type: 'dashBack'; playerId: PlayerId }
  | { type: 'emoted'; playerId: PlayerId; emote: Emote }
  | { type: 'coreHit'; damage: number }
  | { type: 'coreRepaired'; amount: number }
  // Put down by a player.
  | { type: 'trapPlaced'; id: EntityId; kind: string; playerId: PlayerId; x: number; y: number }
  // Dropped already placed by its dying carrier.
  | { type: 'trapDropped'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'trapFired'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'trapTaken'; id: EntityId; kind: string; playerId: PlayerId; x: number; y: number }
  // A trap still placed when a festival stage holds: it leaves as vibes.
  | { type: 'trapBurst'; id: EntityId; kind: string; playerId: PlayerId; x: number; y: number }
  // Worn out where it stood, or above a player's head.
  | { type: 'trapWornOut'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'carriedTrapWornOut'; id: EntityId; kind: string; playerId: PlayerId }
  // A player with the Rallonge walked by it.
  | { type: 'trapRecharged'; id: EntityId; kind: string; playerId: PlayerId; x: number; y: number }
  | { type: 'pickupCollected'; playerId: PlayerId; kind: PickupKind; amount: number }
  | { type: 'bombDropped'; id: EntityId; x: number; y: number }
  // From where it was thrown: the render flies it from there.
  | { type: 'dieDropped'; id: EntityId; x: number; y: number; fromX: number; fromY: number }
  | { type: 'dieCollected'; id: EntityId; playerId: PlayerId; x: number; y: number }
  | { type: 'offerRerolled'; playerId: PlayerId }
  | { type: 'bombExploded'; id: EntityId; playerId: PlayerId; x: number; y: number }
  | { type: 'twinVibesDropped'; id: EntityId; x: number; y: number }
  | { type: 'twinVibesTaken'; id: EntityId; playerId: PlayerId; x: number; y: number }
  | { type: 'twinVibesEnded' }
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
  // The circle of `playerId` stopped a shot of a bad vibe at (x, y).
  | { type: 'shotStopped'; playerId: PlayerId; x: number; y: number }
  | { type: 'enemyYawned'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'enemyBabbled'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'bystanderSpawned'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'bystanderHelped'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'bystanderLost'; id: EntityId; kind: string; x: number; y: number }
  | { type: 'levelUp'; playerId: PlayerId; level: number }
  | { type: 'upgradeChosen'; playerId: PlayerId; upgradeId: string }
  | { type: 'weaponGained'; playerId: PlayerId; weaponId: string }
  // dx, dy: unit direction of the shot.
  | {
      type: 'weaponFired';
      playerId: PlayerId;
      weaponId: string;
      x: number;
      y: number;
      dx?: number;
      dy?: number;
    }
  // A returning weapon (the frisbee) lands in the hand of `playerId`, the ally it flew back to.
  | { type: 'weaponCaught'; playerId: PlayerId; weaponId: string; x: number; y: number }
  // A continuous weapon (the fans) fires every tick: this is its only meaningful moment.
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
  // On the 1: `burnt` at this site, `total` at the stage.
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
  | { type: 'festivalChallengeLit'; index: number; playerId: PlayerId }
  | { type: 'festivalChallengeTaken'; index: number }
  | { type: 'festivalChallengeUnlit'; index: number; playerId: PlayerId }
  | { type: 'festivalChallengeDropped'; index: number }
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
  // Created with the first Festivalier, so a game without one keeps its replay fingerprint.
  bystanders?: BystanderState[];
  // The first trap drawn is `CarrierRules.first`.
  trapsDrawn?: number;
  nextCarrierBar?: number;
  // Due, and no bad vibe carries it yet.
  carrierDue?: boolean;
  // Set by the festival on its last stage only, so other games keep their replay fingerprint.
  trapDraw?: TrapDraw;
  // Optional like `bystanders`, and created with the first bomb dropped.
  bombs?: BombState[];
  nextBombBar?: number;
  // Due, and no bad vibe carries it yet.
  bombDue?: boolean;
  // Optional like `bombs`: created when the stage's vibes jumelles fall due.
  twinVibes?: TwinVibesState;
  // Optional like `bombs`, and created with the first die dropped.
  dice?: DieState[];
  volume?: number;
  speakers?: SpeakerState[];
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
  // From its warning to its end; absent between two.
  gust?: GustState;
  // From the bar before it to its end; absent between two.
  blackout?: BlackoutState;
  // Optional like `bystanders`: created with the first prop of a character who throws them.
  props?: PropState[];
  // Drawn at the window's first rule spawn; no sides means from anywhere.
  spawnWindow?: { index: number; sides: EdgeSide[] };
  // One drawn as each break starts: the last is the boss of the coming or current drop.
  bosses?: string[];
  // Created with the first offering taken.
  summon?: SummonState;
  // The drop goes on until none is left.
  bossesDue?: number;
  // What the bad vibes gain at spawn on top of their own scaling.
  enemyScale?: EnemyScale;
  festival?: FestivalState;
  pendingUpgrades: UpgradeOffer[];
  nextEntityId: EntityId;
  stats: SimStats;
  events: SimEvent[];
}

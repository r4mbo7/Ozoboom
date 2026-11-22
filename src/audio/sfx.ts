import { TRAP_WEAR } from '../data/traps';
import { SOIREE_OUVERTURE } from '../data/tracks';
import type { MusicTrack } from '../data/types';
import type { SimEvent } from '../sim/state';
import type { Cue } from './types';
import { BEATS_PER_BAR, MAIN_TEMPO, type Tempo, barOfTick, ticksIntoBar } from '../shared/tempo';
import { beatSeconds, timeToTick, type Anchor } from './clock';
import { chordRootOfBar, keyHz, type MusicKey } from './scale';
import { playNoise, playTone } from './synth';
import { createVibeArp } from './vibe-arp';
import {
  FULL_ATTACK_CALLS,
  FULL_BAR_CALLS,
  FULL_EVENT_CALLS,
  FULL_EVENT_VARIANTS,
  FULL_SKILL_CALLS,
  FULL_SKILL_LIMITS,
  FULL_SKILL_VOICES,
  FULL_SPECIAL_TAKES,
} from './full';

export type SfxName =
  | keyof typeof FULL_SKILL_VOICES
  | 'playerFired'
  | 'enemyHit'
  | 'enemyDied'
  | 'coreHit'
  | 'trapSub'
  | 'trapCrackle'
  | 'cardDealt'
  | 'cardsReady'
  | 'cardRare'
  | 'cardLegendary'
  | 'upgradeChosen'
  | 'mateChose'
  | 'cardFlight'
  | 'cardLanded'
  | 'skillUsed'
  | 'gameWon'
  | 'gameLost'
  | 'weaponSweep'
  | 'weaponSpark'
  | 'weaponHoop'
  | 'weaponDiabolo'
  | 'weaponFrisbee'
  | 'weaponFrisbeeCaught'
  | 'weaponPlate'
  | 'weaponTotem'
  | 'weaponFans'
  | 'weaponRibbon'
  | 'weaponGained'
  | 'weaponEvolved'
  | 'enemyYawn'
  | 'enemyBottle'
  | 'enemyBabble'
  | 'enemyGrowl'
  | 'bossWhistle'
  | 'bossThunder'
  | 'bossFeedback'
  | 'bossGust'
  | 'fireThrown'
  | 'sporesThrown'
  | 'fireBurnt'
  | 'fireSwing'
  | 'pinceClack'
  | 'giantWoken'
  | 'vibesStolen'
  | 'bystanderHelped'
  | 'bystanderLost'
  | 'trapDropped'
  | 'trapTaken'
  | 'trapPlaced'
  | 'trapRecharged'
  | 'vibesCollected'
  | 'bombDropped'
  | 'dieThrown'
  | 'dieCollected'
  | 'twinVibesTaken'
  | 'batteryTaken'
  | 'potionTaken'
  | 'potionBounced'
  | 'batteryPlugged'
  | 'bombExploded'
  | 'volumeUp'
  | 'skillCharge'
  | 'skillHeal'
  | 'skillGong'
  | 'skillOla'
  | 'taunted'
  | 'playerHealed'
  | 'playerDowned'
  | 'playerRevived'
  | 'playerReviving'
  | 'seatTaken'
  | 'seatFreed'
  | 'launch'
  | 'dashed'
  | 'dashEmpty'
  | 'dashBack'
  | 'vibesHundred'
  | 'vibesThousand';

export interface SfxLimit {
  perFrame: number;
  concurrent: number;
  seconds: number;
}

export interface SfxLimiter {
  beginFrame(): void;
  // `seconds`: how long this one plays, a file by its own length; its limit says otherwise.
  tryAcquire(name: SfxName, now: number, seconds?: number): boolean;
}

// An artist's file in place of a synth voice (src/audio/samples.ts).
export interface SampleVoice {
  // How long it plays, which the limiter holds it for.
  readonly seconds: number;
  readonly play: (out: AudioNode, at: number) => void;
}

// A tonal file plays in the key asked (K7 of ADR 0022).
export interface SfxSamples {
  // Absent until the sound has a decoded file: its synth voice plays.
  sound(name: SfxName, key: MusicKey): SampleVoice | undefined;
  // The shot of an attack kind that plays the shared shot, absent until it has its own file.
  shot(attackKind: string, key: MusicKey): SampleVoice | undefined;
}

const NO_SAMPLES: SfxSamples = { sound: () => undefined, shot: () => undefined };

export type TrapEffectOf = (kind: string) => string;

export interface SfxLookups {
  readonly attackKindOf?: (classId: string) => string | undefined;
  readonly skillKindOf?: (classId: string) => string | undefined;
  readonly weaponKindOf?: (weaponId: string) => string | undefined;
  readonly specialKindOf?: (enemyKind: string) => string | undefined;
}

// The trail (monocycle) is deliberately absent: it stays silent.
const WEAPON_SFX: ReadonlyMap<string, SfxName> = new Map<string, SfxName>(
  Object.entries<SfxName>({
    sweep: 'weaponSweep',
    spark: 'weaponSpark',
    hoop: 'weaponHoop',
    lob: 'weaponDiabolo',
    boomerang: 'weaponFrisbee',
    plate: 'weaponPlate',
    totem: 'weaponTotem',
    ribbon: 'weaponRibbon',
  }),
);

const WEAPON_CAUGHT_SFX: ReadonlyMap<string, SfxName> = new Map<string, SfxName>(
  Object.entries<SfxName>({
    boomerang: 'weaponFrisbeeCaught',
  }),
);

// A continuous weapon would sound every tick on `weaponFired`: it sounds when it touches a bad vibe.
const WEAPON_HIT_SFX: ReadonlyMap<string, SfxName> = new Map<string, SfxName>(
  Object.entries<SfxName>({
    orbit: 'weaponFans',
  }),
);

// An attack sounds its own way when it has a call, the common shot otherwise.
const ATTACK_SFX: ReadonlyMap<string, SfxName> = new Map<string, SfxName>(
  Object.entries(FULL_ATTACK_CALLS),
);

const SKILL_SFX: ReadonlyMap<string, SfxName> = new Map<string, SfxName>(
  Object.entries<SfxName>({
    nova: 'skillUsed',
    dash: 'skillCharge',
    healPulse: 'skillHeal',
    ola: 'skillOla',
    ...FULL_SKILL_CALLS,
  }),
);

export interface SfxPlayer {
  readonly id: number;
  readonly classId: string;
  readonly vibes?: number;
  readonly vibesToNextLevel?: number;
}

export type SfxKey = MusicKey & Pick<MusicTrack, 'chords'>;

export interface SfxCore {
  readonly hp: number;
  readonly maxHp: number;
}

const FULL_CORE: SfxCore = { hp: 1, maxHp: 1 };

export function coreHitDegree(core: SfxCore): number {
  return Math.round((core.hp / core.maxHp) * 7);
}

export interface SfxEnemy extends SfxCore {
  readonly id: number;
  readonly kind?: string;
}

const BOSS_BAR_CALLS: ReadonlyMap<string, SfxName> = new Map<string, SfxName>([
  ['couvre-feu', 'bossWhistle'],
  ...Object.entries(FULL_BAR_CALLS),
]);

export function enemyHitDegree(enemy: SfxCore | undefined): number {
  return enemy === undefined ? 7 : Math.round((1 - Math.max(enemy.hp, 0) / enemy.maxHp) * 7);
}

// A recharge sounds during the plugged beat: when the plug lands, then half a beat later.
const RECHARGE_NOTES_BEATS = [
  [0, TRAP_WEAR.plugInBeats],
  [3, TRAP_WEAR.plugInBeats + TRAP_WEAR.pluggedBeats / 2],
] as const;
const RECHARGE_NOTE_SECONDS = 0.18;
// `level` keeps the take's stacked voices under what the master takes in one instant.
const POTION = {
  thunder: 1.8,
  level: 0.95,
  bodyAfter: 0.025,
  chordAfter: 0.2,
  aftershock: 0.38,
  sparkle: { after: 0.14, every: 0.05, degrees: [0, 4, 7, 0, 4, 7], octaves: [5, 5, 5, 6, 6, 6] },
  bounceDegrees: [0, 3, 1, 4, 2],
} as const;
// The charge-up's rise, then the chord it lands on.
const CHARGE = { rise: 0.24, chord: [0, 4, 7] } as const;

// What follows the beat of the set (the fans, the revive pulse) is throttled to it.
export function sfxLimitsFor(tempo: Tempo): Readonly<Record<SfxName, SfxLimit>> {
  const beat = beatSeconds(tempo);
  return {
    playerFired: { perFrame: 1, concurrent: 3, seconds: 0.09 },
    enemyHit: { perFrame: 2, concurrent: 4, seconds: 0.1 },
    enemyDied: { perFrame: 3, concurrent: 6, seconds: 0.24 },
    coreHit: { perFrame: 1, concurrent: 1, seconds: 0.36 },
    trapSub: { perFrame: 1, concurrent: 2, seconds: 0.3 },
    trapCrackle: { perFrame: 1, concurrent: 1, seconds: 0.1 },
    cardDealt: { perFrame: 1, concurrent: 4, seconds: 0.2 },
    cardsReady: { perFrame: 1, concurrent: 1, seconds: 0.3 },
    cardRare: { perFrame: 1, concurrent: 2, seconds: 0.4 },
    cardLegendary: { perFrame: 1, concurrent: 1, seconds: 0.6 },
    upgradeChosen: { perFrame: 1, concurrent: 2, seconds: 0.6 },
    mateChose: { perFrame: 1, concurrent: 2, seconds: 0.3 },
    cardFlight: { perFrame: 1, concurrent: 2, seconds: beat * 0.8 },
    cardLanded: { perFrame: 1, concurrent: 2, seconds: 0.16 },
    skillUsed: { perFrame: 1, concurrent: 2, seconds: 0.45 },
    gameWon: { perFrame: 1, concurrent: 1, seconds: 2 },
    gameLost: { perFrame: 1, concurrent: 1, seconds: 2 },
    weaponSweep: { perFrame: 1, concurrent: 2, seconds: 0.2 },
    weaponSpark: { perFrame: 1, concurrent: 3, seconds: 0.07 },
    weaponHoop: { perFrame: 1, concurrent: 2, seconds: 0.22 },
    weaponDiabolo: { perFrame: 1, concurrent: 2, seconds: 0.3 },
    weaponFrisbee: { perFrame: 1, concurrent: 2, seconds: 0.2 },
    weaponFrisbeeCaught: { perFrame: 1, concurrent: 2, seconds: 0.22 },
    weaponPlate: { perFrame: 1, concurrent: 2, seconds: 0.4 },
    weaponTotem: { perFrame: 1, concurrent: 1, seconds: 0.5 },
    weaponFans: { perFrame: 1, concurrent: 1, seconds: beat / 2 },
    weaponRibbon: { perFrame: 1, concurrent: 2, seconds: 0.3 },
    weaponGained: { perFrame: 1, concurrent: 1, seconds: 0.5 },
    weaponEvolved: { perFrame: 1, concurrent: 1, seconds: 0.8 },
    enemyYawn: { perFrame: 1, concurrent: 2, seconds: 0.6 },
    enemyBottle: { perFrame: 1, concurrent: 2, seconds: 0.3 },
    enemyBabble: { perFrame: 1, concurrent: 2, seconds: 0.15 },
    enemyGrowl: { perFrame: 1, concurrent: 2, seconds: 0.35 },
    bossWhistle: { perFrame: 1, concurrent: 1, seconds: 0.2 },
    bossThunder: { perFrame: 1, concurrent: 1, seconds: 0.5 },
    bossFeedback: { perFrame: 1, concurrent: 1, seconds: 0.8 },
    bossGust: { perFrame: 1, concurrent: 1, seconds: 1.2 },
    fireThrown: { perFrame: 1, concurrent: 2, seconds: beat * BEATS_PER_BAR },
    sporesThrown: { perFrame: 1, concurrent: 2, seconds: beat },
    fireBurnt: { perFrame: 1, concurrent: 2, seconds: beat * BEATS_PER_BAR },
    fireSwing: { perFrame: 1, concurrent: 3, seconds: 0.3 },
    pinceClack: { perFrame: 1, concurrent: 3, seconds: 0.1 },
    giantWoken: { perFrame: 1, concurrent: 2, seconds: 1 },
    vibesStolen: { perFrame: 1, concurrent: 2, seconds: 0.25 },
    bystanderHelped: { perFrame: 1, concurrent: 2, seconds: 0.6 },
    bystanderLost: { perFrame: 1, concurrent: 1, seconds: 0.5 },
    trapDropped: { perFrame: 1, concurrent: 2, seconds: 0.4 },
    trapTaken: { perFrame: 1, concurrent: 2, seconds: 0.15 },
    trapPlaced: { perFrame: 1, concurrent: 2, seconds: 0.2 },
    trapRecharged: {
      perFrame: 1,
      concurrent: 2,
      seconds: beat * (TRAP_WEAR.plugInBeats + TRAP_WEAR.pluggedBeats / 2) + RECHARGE_NOTE_SECONDS,
    },
    vibesCollected: { perFrame: 1, concurrent: 2, seconds: 0.15 },
    bombDropped: { perFrame: 1, concurrent: 1, seconds: 0.5 },
    dieThrown: { perFrame: 1, concurrent: 2, seconds: beat + 0.9 },
    dieCollected: { perFrame: 1, concurrent: 2, seconds: 0.35 },
    twinVibesTaken: { perFrame: 1, concurrent: 1, seconds: 0.6 },
    batteryTaken: { perFrame: 1, concurrent: 1, seconds: 0.6 },
    // Up to a beat more breath lands the BANG on a beat.
    potionTaken: { perFrame: 1, concurrent: 1, seconds: POTION.thunder },
    potionBounced: { perFrame: 1, concurrent: 2, seconds: 0.25 },
    batteryPlugged: {
      perFrame: 1,
      concurrent: 2,
      seconds: beat * (TRAP_WEAR.plugInBeats + TRAP_WEAR.pluggedBeats / 2) + RECHARGE_NOTE_SECONDS,
    },
    bombExploded: { perFrame: 1, concurrent: 1, seconds: 1.6 },
    volumeUp: { perFrame: 1, concurrent: 1, seconds: 0.6 },
    skillCharge: { perFrame: 1, concurrent: 2, seconds: 0.45 },
    skillHeal: { perFrame: 1, concurrent: 2, seconds: 0.7 },
    skillGong: { perFrame: 1, concurrent: 2, seconds: 0.6 },
    skillOla: { perFrame: 1, concurrent: 2, seconds: 0.4 },
    ...FULL_SKILL_LIMITS,
    taunted: { perFrame: 1, concurrent: 2, seconds: 0.5 },
    playerHealed: { perFrame: 1, concurrent: 2, seconds: 0.15 },
    playerDowned: { perFrame: 1, concurrent: 2, seconds: 0.6 },
    playerRevived: { perFrame: 1, concurrent: 2, seconds: 0.8 },
    playerReviving: { perFrame: 1, concurrent: 1, seconds: beat },
    seatTaken: { perFrame: 1, concurrent: 2, seconds: 0.4 },
    seatFreed: { perFrame: 1, concurrent: 2, seconds: 0.4 },
    launch: { perFrame: 1, concurrent: 1, seconds: 1.4 },
    dashed: { perFrame: 1, concurrent: 2, seconds: 0.2 },
    dashEmpty: { perFrame: 1, concurrent: 1, seconds: 0.15 },
    dashBack: { perFrame: 1, concurrent: 2, seconds: 0.25 },
    vibesHundred: { perFrame: 1, concurrent: 1, seconds: beat },
    vibesThousand: { perFrame: 1, concurrent: 1, seconds: 2 * beat },
  };
}

const SFX_LIMITS = sfxLimitsFor(MAIN_TEMPO);

// The attack kind of the player who fired.
function firedAttackKind(
  event: SimEvent,
  lookups: SfxLookups,
  players: readonly SfxPlayer[],
): string | undefined {
  const classId =
    event.type === 'playerFired'
      ? players.find((player) => player.id === event.playerId)?.classId
      : undefined;
  return classId === undefined ? undefined : lookups.attackKindOf?.(classId);
}

export function sfxOf(
  event: SimEvent,
  trapEffectOf: TrapEffectOf,
  lookups: SfxLookups = {},
  players: readonly SfxPlayer[] = [],
): SfxName | null {
  switch (event.type) {
    case 'playerFired': {
      const kind = firedAttackKind(event, lookups, players);
      return (kind === undefined ? undefined : ATTACK_SFX.get(kind)) ?? event.type;
    }
    case 'enemyHit':
    case 'enemyDied':
    case 'coreHit':
    case 'gameWon':
    case 'gameLost':
    case 'weaponGained':
    case 'weaponEvolved':
    case 'vibesStolen':
    case 'bystanderHelped':
    case 'bystanderLost':
    case 'taunted':
    case 'playerHealed':
    case 'playerDowned':
    case 'playerRevived':
    case 'playerReviving':
    case 'trapDropped':
    case 'trapTaken':
    case 'trapPlaced':
    case 'trapRecharged':
    case 'bombDropped':
    case 'bombExploded':
      return event.type;
    case 'batteryDropped':
      return 'bombDropped';
    case 'batteryTaken':
    case 'batteryPlugged':
    case 'potionTaken':
    case 'potionBounced':
      return event.type;
    case 'potionDropped':
      return 'bombDropped';
    case 'pickupCollected':
      return 'vibesCollected';
    case 'vibesMilestone':
      return event.milestone === 'thousand' ? 'vibesThousand' : 'vibesHundred';
    case 'dieDropped':
      return 'dieThrown';
    case 'dieCollected':
    case 'twinVibesTaken':
      return event.type;
    case 'dashed':
    case 'dashEmpty':
    case 'dashBack':
      return event.type;
    case 'skillUsed': {
      const classId = players.find((player) => player.id === event.playerId)?.classId;
      const kind = classId === undefined ? undefined : lookups.skillKindOf?.(classId);
      return kind === undefined ? null : (SKILL_SFX.get(kind) ?? null);
    }
    case 'weaponFired': {
      const kind = lookups.weaponKindOf?.(event.weaponId);
      return kind === undefined ? null : (WEAPON_SFX.get(kind) ?? null);
    }
    case 'weaponHit': {
      const kind = lookups.weaponKindOf?.(event.weaponId);
      return kind === undefined ? null : (WEAPON_HIT_SFX.get(kind) ?? null);
    }
    case 'weaponCaught': {
      const kind = lookups.weaponKindOf?.(event.weaponId);
      return kind === undefined ? null : (WEAPON_CAUGHT_SFX.get(kind) ?? null);
    }
    case 'enemyYawned':
      return 'enemyYawn';
    case 'enemyShot':
      return lookups.specialKindOf?.(event.kind) === 'bottle' ? 'enemyBottle' : null;
    case 'enemyBabbled':
      return 'enemyBabble';
    case 'enemyRevived':
      return 'enemyGrowl';
    case 'dancerUnmasked':
      return 'bystanderHelped';
    case 'dancerMasked':
      return 'bystanderLost';
    case 'volumeChanged':
      return 'volumeUp';
    case 'trapFired': {
      const effect = trapEffectOf(event.kind);
      if (effect === 'shockwave') {
        return 'trapSub';
      }
      return effect === 'beam' ? 'trapCrackle' : null;
    }
    default:
      return callOf(BOSS_EVENT_CALLS[event.type], event);
  }
}

export type EventCall = SfxName | ((event: SimEvent) => SfxName | null);
// The variant a sound plays an event at, read from the event and the sim's tick when known.
export type EventVariant = (event: SimEvent, tick: number | undefined, tempo: Tempo) => number;
const EVENT_VARIANTS: Readonly<Partial<Record<SfxName, EventVariant>>> = FULL_EVENT_VARIANTS;
const BOSS_EVENT_CALLS: Readonly<Partial<Record<SimEvent['type'], EventCall>>> = {
  gust: 'bossGust',
  ...FULL_EVENT_CALLS,
};

function callOf(
  call: SfxName | ((event: SimEvent) => SfxName | null) | undefined,
  event: SimEvent,
): SfxName | null {
  return typeof call === 'function' ? call(event) : (call ?? null);
}

export function createSfxLimiter(limits: Readonly<Record<SfxName, SfxLimit>>): SfxLimiter {
  const playedThisFrame = new Map<SfxName, number>();
  const endings = new Map<SfxName, number[]>();
  return {
    beginFrame() {
      playedThisFrame.clear();
    },
    tryAcquire(name, now, seconds = limits[name].seconds) {
      const limit = limits[name];
      const played = playedThisFrame.get(name) ?? 0;
      if (played >= limit.perFrame) {
        return false;
      }
      const sounding = (endings.get(name) ?? []).filter((end) => end > now);
      endings.set(name, sounding);
      if (sounding.length >= limit.concurrent) {
        return false;
      }
      sounding.push(now + seconds);
      playedThisFrame.set(name, played + 1);
      return true;
    },
  };
}

// One casting of a special: what it sounds through, `after` seconds from the first.
export type SpecialTake = readonly { readonly after: number; readonly event: SimEvent }[];

// A special that sounds through its `skillUsed` alone.
export const SPECIAL_CAST: SpecialTake = [{ after: 0, event: { type: 'skillUsed', playerId: 0 } }];

// Each casting of a special of this kind, as the game sounds it.
export function specialTakes(kind: string): readonly SpecialTake[] {
  return FULL_SPECIAL_TAKES[kind] ?? [SPECIAL_CAST];
}

// A weapon as the game hears it, one sound a beat after the other: its throw, its touch, its catch.
// Empty for a weapon the game keeps silent, the trail.
export function weaponTake(weaponId: string, kind: string, beat: number): SpecialTake {
  const origin = { playerId: 0, x: 0, y: 0 } as const;
  const events: readonly SimEvent[] = [
    { type: 'weaponFired', weaponId, ...origin },
    { type: 'weaponHit', weaponId, id: 0, ...origin },
    { type: 'weaponCaught', weaponId, ...origin },
  ];
  const lookups = { weaponKindOf: () => kind };
  return events
    .filter((event) => sfxOf(event, (trap) => trap, lookups) !== null)
    .map((event, index) => ({ after: index * beat, event }));
}

export type Voice = (
  out: AudioNode,
  at: number,
  variant: number,
  key: MusicKey,
  vibes?: number,
  progress?: number,
  // Seconds per beat, for a sound as long as a motion counted in beats.
  beat?: number,
) => void;

const DIED_DEGREES = [4, 3, 0, 5];
const TWIN_CLIMB = [0, 2, 4, 7] as const;
const HUNDRED_CHIME = [0, 4, 7] as const;
const THOUSAND_CHIME = [0, 2, 4, 7, 11] as const;

// A gold bell per degree above the chord root, rolled on sixteenths: the crown of the vibes counter.
function vibesChime(
  out: AudioNode,
  at: number,
  root: number,
  key: MusicKey,
  degrees: readonly number[],
  beat: number,
): void {
  degrees.forEach((degree, index) => {
    const when = at + (index * beat) / 4;
    playTone(out, when, {
      wave: 'sine',
      hz: keyHz(key, root + degree, 5),
      gain: 0.12,
      attack: 0.002,
      hold: 0.02,
      release: 0.5,
    });
    playTone(out, when, {
      wave: 'sine',
      hz: keyHz(key, root + degree + 7, 5),
      gain: 0.035,
      attack: 0.002,
      hold: 0.01,
      release: 0.3,
    });
  });
}
// The bounce in beats after the throw, as `src/render/dice.ts` draws it; the clicks of the rattle in
// seconds after it; the coins of the landing, degrees rung one after the other.
const DIE = {
  bounce: 0.6,
  rattle: [
    { after: 0, gain: 1, degree: 4 },
    { after: 0.032, gain: 0.7, degree: 7 },
    { after: 0.07, gain: 0.45, degree: 4 },
  ],
  coins: [0, 2, 4, 7],
  // After the clack of the landing, which would add up with the first coin over the master's limiter.
  coinsAfter: 0.04,
  coinStep: 0.05,
} as const;

// A plug thrown at `at` sounds as it lands, then half a beat later, `step` degrees up the scale.
function rechargeNotes(
  out: AudioNode,
  at: number,
  key: MusicKey,
  beat: number,
  step: number,
): void {
  for (const [degree, afterBeats] of RECHARGE_NOTES_BEATS) {
    playTone(out, at + beat * afterBeats, {
      wave: 'triangle',
      hz: keyHz(key, step + degree, 2),
      gain: 0.14,
      attack: 0.01,
      hold: 0.05,
      release: RECHARGE_NOTE_SECONDS - 0.06,
      filter: { type: 'lowpass', hz: 1200 },
    });
  }
}

// A bass thump with a body, `level` 1 at its loudest; kept low, the mids carry the loudness.
function dieThump(out: AudioNode, at: number, key: MusicKey, level: number): void {
  playTone(out, at, {
    wave: 'sine',
    hz: keyHz(key, 0, 2),
    toHz: keyHz(key, 0, 1),
    glide: 0.12,
    gain: 0.3 * level,
    attack: 0.002,
    hold: 0.05,
    release: 0.16,
  });
  playTone(out, at, {
    wave: 'triangle',
    hz: keyHz(key, 0, 4),
    toHz: keyHz(key, 0, 3),
    glide: 0.06,
    gain: 0.2 * level,
    attack: 0.002,
    hold: 0.015,
    release: 0.08,
  });
}
const THROWN_FLIGHT_BEATS = 0.5;

// The short breath of an offering leaving the hands.
function tossBreath(out: AudioNode, at: number): void {
  playNoise(out, at, {
    gain: 0.07,
    attack: 0.04,
    hold: 0.03,
    release: 0.14,
    filter: { type: 'bandpass', hz: 600, toHz: 1500, glide: 0.12, q: 0.9 },
  });
}

const FLARE_RISER_BEATS = 0.5;
// The flare's open chord, [degree, octave, pan], and the bells that run across with its rays.
const FLARE_CHORD = [
  [0, 2, 0],
  [4, 2, -0.2],
  [0, 3, 0.2],
  [4, 3, -0.35],
  [0, 4, 0.35],
  [2, 4, 0],
] as const;
const FLARE_BELLS = [0, 2, 4, 7, 9, 11] as const;

// Up to half a beat before the 1 that burns an offering: noise and a fifth climbing an octave,
// swelling like a reversed sound, cut right on the 1.
function flareRiser(out: AudioNode, from: number, one: number, key: MusicKey): void {
  const rise = one - from;
  if (rise < 0.05) {
    return;
  }
  const swell = { attack: rise - 0.015, hold: 0, release: 0.025 };
  playNoise(out, from, {
    gain: 0.16,
    ...swell,
    filter: { type: 'bandpass', hz: 700, toHz: 5200, glide: rise, q: 1.4 },
  });
  for (const [degree, gain, pan] of [
    [0, 0.09, -0.3],
    [4, 0.06, 0.3],
  ] as const) {
    playTone(out, from, {
      wave: 'triangle',
      hz: keyHz(key, degree, 3),
      toHz: keyHz(key, degree, 4),
      glide: rise,
      gain,
      ...swell,
      pan,
    });
  }
}

// One crack of a fire, scattered a little in time and across the stereo.
function fireSpark(out: AudioNode, at: number, index: number, gain: number): void {
  const scatter = Math.abs(Math.sin((at + index) * 78.233) * 43_758.545) % 1;
  playNoise(out, at + scatter * 0.05, {
    gain,
    attack: 0.001,
    hold: 0.004,
    release: 0.03,
    pan: scatter * 1.2 - 0.6,
    filter: { type: 'highpass', hz: 3500, q: 0.7 },
  });
}

const DEALT_DEGREES = [0, 2, 4, 5];
const FANS_DEGREES = [0, 2, 4, 2, 5, 4];

export const VOICES: Readonly<Record<SfxName, Voice>> = {
  ...FULL_SKILL_VOICES,
  playerFired: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'square',
      hz: keyHz(key, 0, 6),
      toHz: keyHz(key, 0, 5),
      glide: 0.06,
      gain: 0.1,
      attack: 0.002,
      hold: 0.01,
      release: 0.07,
      filter: { type: 'highpass', hz: 500 },
    });
  },
  enemyHit: (out, at, degree, key) => {
    playNoise(out, at, {
      gain: 0.3,
      attack: 0.001,
      hold: 0.004,
      release: 0.03,
      filter: { type: 'lowpass', hz: 900, q: 1 },
    });
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, degree, 4),
      gain: 0.14,
      attack: 0.002,
      hold: 0.012,
      release: 0.09,
    });
  },
  enemyDied: (out, at, variant, key) => {
    const hz = keyHz(key, DIED_DEGREES[variant % DIED_DEGREES.length] ?? 0, 3);
    playTone(out, at, {
      wave: 'triangle',
      hz,
      toHz: hz / 4,
      glide: 0.2,
      gain: 0.3,
      attack: 0.003,
      hold: 0.03,
      release: 0.2,
      filter: { type: 'lowpass', hz: 700, toHz: 200, glide: 0.2 },
    });
    playNoise(out, at, {
      gain: 0.12,
      attack: 0.002,
      hold: 0.01,
      release: 0.08,
      filter: { type: 'lowpass', hz: 400 },
    });
  },
  coreHit: (out, at, degree, key) => {
    const hz = keyHz(key, degree, 2);
    playTone(out, at, {
      wave: 'triangle',
      hz,
      toHz: hz * 0.62,
      glide: 0.06,
      gain: 0.38,
      attack: 0.001,
      hold: 0.01,
      release: 0.09,
      filter: { type: 'lowpass', hz: 900 },
    });
    playNoise(out, at, {
      gain: 0.18,
      attack: 0.001,
      hold: 0.004,
      release: 0.04,
      filter: { type: 'bandpass', hz: 850, q: 2.5 },
    });
  },
  trapSub: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, 0, 1),
      toHz: keyHz(key, 0, 0),
      glide: 0.15,
      gain: 0.45,
      attack: 0.005,
      hold: 0.05,
      release: 0.24,
    });
  },
  trapCrackle: (out, at) => {
    const scatter = Math.abs(Math.sin(at * 78.233) * 43_758.545) % 1;
    playNoise(out, at + scatter * 0.03, {
      gain: 0.05,
      attack: 0.001,
      hold: 0.004,
      release: 0.025,
      pan: scatter * 1.2 - 0.6,
      filter: { type: 'highpass', hz: 5500, q: 0.7 },
    });
  },
  cardDealt: (out, at, turn, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, DEALT_DEGREES[turn % DEALT_DEGREES.length] ?? 0, 4),
      gain: 0.15,
      attack: 0.005,
      hold: 0.04,
      release: 0.2,
    });
    playNoise(out, at, {
      gain: 0.05,
      attack: 0.001,
      hold: 0,
      release: 0.07,
      filter: { type: 'bandpass', hz: 1800, q: 1 },
    });
  },
  cardsReady: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 7, 4),
      gain: 0.17,
      attack: 0.005,
      hold: 0.04,
      release: 0.3,
    });
  },
  cardRare: (out, at, _variant, key) => {
    [4, 7].forEach((degree, index) => {
      playTone(out, at + index * 0.06, {
        wave: 'sine',
        hz: keyHz(key, degree, 5),
        gain: 0.11,
        attack: 0.005,
        hold: 0.04,
        release: 0.32,
      });
    });
  },
  cardLegendary: (out, at, _variant, key) => {
    [0, 2, 4, 7, 9].forEach((degree, index) => {
      playTone(out, at + index * 0.055, {
        wave: 'triangle',
        hz: keyHz(key, degree, 5),
        gain: 0.11,
        attack: 0.005,
        hold: 0.04,
        release: 0.4,
      });
    });
    playNoise(out, at, {
      gain: 0.04,
      attack: 0.001,
      hold: 0,
      release: 0.6,
      filter: { type: 'highpass', hz: 7000, q: 1 },
    });
  },
  upgradeChosen: (out, at, _variant, key) => {
    for (const degree of [0, 2, 4, 7]) {
      for (const [wave, gain] of [
        ['sawtooth', 0.04],
        ['triangle', 0.1],
      ] as const) {
        playTone(out, at + 0.07, {
          wave,
          hz: keyHz(key, degree, 4),
          gain,
          attack: 0.005,
          hold: 0.08,
          release: 0.5,
        });
      }
    }
    playTone(out, at, {
      wave: 'sine',
      hz: 160,
      toHz: 50,
      glide: 0.1,
      gain: 0.4,
      attack: 0.002,
      hold: 0.03,
      release: 0.14,
    });
    playNoise(out, at + 0.07, {
      gain: 0.08,
      attack: 0.001,
      hold: 0,
      release: 0.18,
      filter: { type: 'highpass', hz: 5000, q: 1 },
    });
  },
  mateChose: (out, at, _variant, key) => {
    [2, 4].forEach((degree, index) => {
      playTone(out, at + index * 0.08, {
        wave: 'sine',
        hz: keyHz(key, degree, 4),
        gain: 0.09,
        attack: 0.005,
        hold: 0.04,
        release: 0.25,
      });
    });
  },
  cardFlight: (out, at, _variant, _key, _vibes, _progress, beat = beatSeconds()) => {
    playNoise(out, at, {
      gain: 0.09,
      attack: 0.001,
      hold: 0,
      release: beat * 0.8,
      filter: { type: 'bandpass', hz: 2600, toHz: 500, glide: beat * 0.8, q: 1.4 },
    });
  },
  cardLanded: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, 7, 5),
      gain: 0.13,
      attack: 0.002,
      hold: 0.02,
      release: 0.14,
    });
  },
  skillUsed: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'sawtooth',
      hz: keyHz(key, 0, 3),
      toHz: keyHz(key, 0, 5),
      glide: 0.2,
      gain: 0.25,
      attack: 0.01,
      hold: 0.12,
      release: 0.29,
      filter: { type: 'lowpass', hz: 800, toHz: 5000, glide: 0.2, q: 4 },
    });
    playNoise(out, at, {
      gain: 0.3,
      attack: 0.08,
      hold: 0.05,
      release: 0.29,
      filter: { type: 'bandpass', hz: 1000, toHz: 6000, glide: 0.25, q: 1.2 },
    });
  },
  gameWon: (out, at, _variant, key) => {
    [0, 4, 7, 12].forEach((semitones, index) => {
      playTone(out, at + index * 0.15, {
        wave: 'triangle',
        hz: keyHz(key, 0, 4) * 2 ** (semitones / 12),
        gain: 0.14,
        attack: 0.01,
        hold: 0.2,
        release: 1.2,
      });
    });
  },
  gameLost: (out, at, _variant, key) => {
    [4, 2, 1, 0].forEach((degree, index) => {
      playTone(out, at + index * 0.3, {
        wave: 'triangle',
        hz: keyHz(key, degree, 3),
        toHz: keyHz(key, degree, 3) * 0.94,
        glide: 0.3,
        gain: 0.16,
        attack: 0.01,
        hold: 0.15,
        release: 0.4,
        filter: { type: 'lowpass', hz: 1500, toHz: 400, glide: 0.5 },
      });
    });
  },
  weaponSweep: (out, at) => {
    playNoise(out, at, {
      gain: 0.5,
      attack: 0.04,
      hold: 0.03,
      release: 0.14,
      filter: { type: 'bandpass', hz: 500, toHz: 2400, glide: 0.2, q: 0.9 },
    });
  },
  weaponSpark: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, 4, 6),
      toHz: keyHz(key, 4, 6) * 1.5,
      glide: 0.04,
      gain: 0.12,
      attack: 0.001,
      hold: 0.004,
      release: 0.06,
    });
    playNoise(out, at, {
      gain: 0.06,
      attack: 0.001,
      hold: 0.002,
      release: 0.015,
      filter: { type: 'highpass', hz: 6000 },
    });
  },
  weaponHoop: (out, at) => {
    playNoise(out, at, {
      gain: 0.7,
      attack: 0.03,
      hold: 0.05,
      release: 0.14,
      filter: { type: 'bandpass', hz: 1700, toHz: 3300, glide: 0.2, q: 6 },
    });
  },
  weaponDiabolo: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 0, 4),
      toHz: keyHz(key, 4, 4),
      glide: 0.13,
      gain: 0.15,
      attack: 0.005,
      hold: 0.11,
      release: 0.02,
    });
    playTone(out, at + 0.14, {
      wave: 'triangle',
      hz: keyHz(key, 4, 4),
      toHz: keyHz(key, 1, 4),
      glide: 0.14,
      gain: 0.15,
      attack: 0.005,
      hold: 0.12,
      release: 0.06,
    });
  },
  weaponFrisbee: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 0, 2),
      toHz: keyHz(key, 4, 2),
      glide: 0.05,
      gain: 0.17,
      attack: 0.004,
      hold: 0.06,
      release: 0.12,
      filter: { type: 'lowpass', hz: 1200 },
    });
  },
  weaponFrisbeeCaught: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 4, 2),
      toHz: keyHz(key, 0, 2),
      glide: 0.06,
      gain: 0.19,
      attack: 0.004,
      hold: 0.05,
      release: 0.16,
      filter: { type: 'lowpass', hz: 900 },
    });
  },
  weaponPlate: (out, at, _variant, key) => {
    const root = keyHz(key, 3, 5);
    [1, 2.76, 5.4].forEach((ratio, index) => {
      playTone(out, at, {
        wave: 'sine',
        hz: root * ratio,
        gain: 0.1 / (index + 1),
        attack: 0.001,
        hold: 0.01,
        release: 0.3 - index * 0.08,
      });
    });
  },
  weaponTotem: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, 4, 1),
      toHz: keyHz(key, 4, 0),
      glide: 0.22,
      gain: 0.5,
      attack: 0.003,
      hold: 0.06,
      release: 0.3,
    });
    playNoise(out, at, {
      gain: 0.18,
      attack: 0.001,
      hold: 0.006,
      release: 0.05,
      filter: { type: 'lowpass', hz: 350 },
    });
  },
  weaponFans: (out, at, variant, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, FANS_DEGREES[variant % FANS_DEGREES.length] ?? 0, 5),
      gain: 0.1,
      attack: 0.002,
      hold: 0.01,
      release: 0.11,
      filter: { type: 'highpass', hz: 400 },
    });
    playNoise(out, at, {
      gain: 0.05,
      attack: 0.004,
      hold: 0.01,
      release: 0.06,
      filter: { type: 'bandpass', hz: 2600, q: 1.2 },
    });
  },
  weaponRibbon: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 0, 6),
      toHz: keyHz(key, 4, 7),
      glide: 0.26,
      gain: 0.15,
      attack: 0.01,
      hold: 0.2,
      release: 0.1,
      vibrato: { hz: 8, cents: 30, delay: 0.04 },
    });
  },
  trapDropped: (out, at, _variant, key) => {
    playNoise(out, at, {
      gain: 0.22,
      attack: 0.002,
      hold: 0.02,
      release: 0.12,
      filter: { type: 'lowpass', hz: 600, q: 1.5 },
    });
    playTone(out, at + 0.05, {
      wave: 'triangle',
      hz: keyHz(key, 4, 5),
      gain: 0.08,
      attack: 0.004,
      hold: 0.04,
      release: 0.22,
    });
  },
  // One low note that glides a fifth up, then the same note back down: a single note, unlike the
  // Rallonge's two.
  trapTaken: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 0, 2),
      toHz: keyHz(key, 4, 2),
      glide: 0.09,
      gain: 0.13,
      attack: 0.005,
      hold: 0.045,
      release: 0.08,
      filter: { type: 'lowpass', hz: 1400 },
    });
  },
  trapPlaced: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 4, 2),
      toHz: keyHz(key, 0, 2),
      glide: 0.11,
      gain: 0.11,
      attack: 0.006,
      hold: 0.02,
      release: 0.14,
      filter: { type: 'lowpass', hz: 1100 },
    });
  },
  trapRecharged: (out, at, _variant, key, _vibes, _progress, beat = beatSeconds(MAIN_TEMPO)) => {
    rechargeNotes(out, at, key, beat, 0);
  },
  // The Rallonge's two low notes, a scale step higher for each cord of the sweep, back down after an octave.
  batteryPlugged: (out, at, index, key, _vibes, _progress, beat = beatSeconds(MAIN_TEMPO)) => {
    rechargeNotes(out, at, key, beat, index % key.scale.length);
  },
  vibesCollected: (out, at, degree, key, vibes = 1, progress = 0) => {
    const gain = 0.07 + 0.008 * vibes;
    const hz = keyHz(key, degree, 4);
    playTone(out, at, {
      wave: 'triangle',
      hz,
      gain,
      attack: 0.003,
      hold: 0.02,
      release: 0.12,
      // The cutoff follows the note: a fixed one silenced the top of the arpeggio.
      filter: { type: 'lowpass', hz: hz * (1.6 + 4.4 * progress) },
    });
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, degree, 5),
      gain: gain * (0.08 + 0.3 * progress),
      attack: 0.002,
      hold: 0.01,
      release: 0.09,
    });
    if (progress > 0.8) {
      playTone(out, at, {
        wave: 'sine',
        hz: keyHz(key, degree + 4, 4),
        gain: gain * 0.35,
        attack: 0.003,
        hold: 0.02,
        release: 0.14,
      });
    }
  },
  // Follows the die thrown, loud like a jackpot: a thump and a whoosh as it leaves, three clicks as it
  // rattles on its bounce, and on the beat it lands a thump and coins ringing up to the octave.
  // Two rising notes: the player gains something to spend.
  dieCollected: (out, at, _variant, key) => {
    [0, 4].forEach((degree, index) => {
      playTone(out, at + index * 0.06, {
        wave: 'square',
        hz: keyHz(key, degree, 5),
        gain: 0.07,
        attack: 0.003,
        hold: 0.04,
        release: 0.16,
        filter: { type: 'lowpass', hz: 2400 },
      });
    });
  },
  vibesHundred: (out, at, root, key, _vibes, _progress, beat = beatSeconds(MAIN_TEMPO)) => {
    vibesChime(out, at, root, key, HUNDRED_CHIME, beat);
  },
  vibesThousand: (out, at, root, key, _vibes, _progress, beat = beatSeconds(MAIN_TEMPO)) => {
    vibesChime(out, at, root, key, THOUSAND_CHIME, beat);
  },
  // Two voices a third apart climb to the octave: the vibes come in pairs.
  twinVibesTaken: (out, at, _variant, key) => {
    TWIN_CLIMB.forEach((degree, index) => {
      [degree, degree + 2].forEach((voice) => {
        playTone(out, at + index * 0.07, {
          wave: 'triangle',
          hz: keyHz(key, voice, 5),
          gain: 0.08,
          attack: 0.004,
          hold: 0.06,
          release: 0.3,
        });
      });
    });
  },
  // A charge-up, loud like a jackpot: a thump, a buzzing rise from low to the octave as its filter opens, and a
  // bright chord on top once full.
  batteryTaken: (out, at, _variant, key) => {
    dieThump(out, at, key, 0.8);
    playTone(out, at, {
      wave: 'sawtooth',
      hz: keyHz(key, 0, 3),
      toHz: keyHz(key, 0, 5),
      glide: CHARGE.rise,
      gain: 0.08,
      attack: 0.01,
      hold: CHARGE.rise - 0.01,
      release: 0.05,
      filter: { type: 'lowpass', hz: 500, toHz: 3600, glide: CHARGE.rise, q: 4 },
    });
    CHARGE.chord.forEach((degree, index) => {
      const hz = keyHz(key, degree, 5);
      const pan = -0.25 + (0.5 * index) / (CHARGE.chord.length - 1);
      playTone(out, at + CHARGE.rise, {
        wave: 'triangle',
        hz,
        gain: 0.16,
        attack: 0.003,
        hold: 0.04,
        release: 0.28,
        pan,
      });
      playTone(out, at + CHARGE.rise, {
        wave: 'square',
        hz,
        gain: 0.05,
        attack: 0.003,
        hold: 0.02,
        release: 0.08,
        filter: { type: 'lowpass', hz: 5000 },
        pan,
      });
    });
  },
  dieThrown: (out, at, _variant, key, _vibes, _progress, beat = beatSeconds(MAIN_TEMPO)) => {
    dieThump(out, at, key, 0.95);
    playNoise(out, at, {
      gain: 0.24,
      attack: 0.001,
      hold: 0.005,
      release: 0.03,
      filter: { type: 'highpass', hz: 3000, q: 1 },
    });
    playNoise(out, at + 0.01, {
      gain: 0.24,
      attack: 0.07,
      hold: 0.04,
      release: 0.1,
      filter: { type: 'bandpass', hz: 700, toHz: 4200, glide: 0.2, q: 1.4 },
    });
    for (const click of DIE.rattle) {
      const clickAt = at + DIE.bounce * beat + click.after;
      playNoise(out, clickAt, {
        gain: 0.45 * click.gain,
        attack: 0.001,
        hold: 0.004,
        release: 0.03,
        filter: { type: 'bandpass', hz: 2800, q: 5 },
      });
      playTone(out, clickAt, {
        wave: 'sine',
        hz: keyHz(key, click.degree, 4),
        toHz: keyHz(key, click.degree, 4) * 0.8,
        glide: 0.03,
        gain: 0.33 * click.gain,
        attack: 0.001,
        hold: 0.008,
        release: 0.04,
      });
    }
    const land = at + beat;
    dieThump(out, land, key, 1);
    playNoise(out, land, {
      gain: 0.3,
      attack: 0.001,
      hold: 0.008,
      release: 0.05,
      filter: { type: 'bandpass', hz: 2600, q: 2 },
    });
    DIE.coins.forEach((degree, index) => {
      const coinAt = land + DIE.coinsAfter + index * DIE.coinStep;
      const last = index === DIE.coins.length - 1;
      const pan = -0.3 + (0.6 * index) / (DIE.coins.length - 1);
      const hz = keyHz(key, degree, 5);
      playTone(out, coinAt, {
        wave: 'triangle',
        hz,
        gain: 0.3,
        attack: 0.002,
        hold: 0.03,
        release: last ? 0.8 : 0.25,
        pan,
      });
      playTone(out, coinAt, {
        wave: 'square',
        hz,
        gain: 0.1,
        attack: 0.002,
        hold: 0.02,
        release: 0.08,
        filter: { type: 'lowpass', hz: 5000 },
        pan,
      });
      playTone(out, coinAt, {
        wave: 'sine',
        hz: keyHz(key, degree, 6),
        gain: 0.1,
        attack: 0.002,
        hold: 0.01,
        release: last ? 0.6 : 0.15,
        pan,
      });
    });
    playNoise(out, land + DIE.coinsAfter, {
      gain: 0.12,
      attack: 0.002,
      hold: 0.02,
      release: 0.6,
      filter: { type: 'highpass', hz: 7000, q: 1 },
    });
  },
  // A dry crack, the BANG's body a flam later, then a second blow: spread so the voices never
  // stack at one instant. Most of the gain sits in the mids, where the ear and a small speaker
  // hear it loudest, with a lighter sub for the weight.
  potionTaken: (out, at, _variant, key) => {
    const { level, bodyAfter, chordAfter, aftershock, sparkle } = POTION;
    const body = at + bodyAfter;
    playNoise(out, at, {
      gain: 0.35 * level,
      attack: 0.001,
      hold: 0.006,
      release: 0.04,
      filter: { type: 'highpass', hz: 2500 },
    });
    playNoise(out, at, {
      gain: 0.25 * level,
      attack: 0.001,
      hold: 0.01,
      release: 0.25,
      filter: { type: 'bandpass', hz: 3000, toHz: 1200, glide: 0.25, q: 0.8 },
    });
    const brass = { type: 'lowpass', hz: 6000, toHz: 900, glide: 0.4, q: 1.5 } as const;
    playTone(out, body, {
      wave: 'square',
      hz: keyHz(key, 0, 3),
      toHz: keyHz(key, 0, 2),
      glide: 0.2,
      gain: 0.2 * level,
      attack: 0.002,
      hold: 0.1,
      release: 0.5,
      filter: brass,
    });
    [-1, 1].forEach((side) => {
      playTone(out, body, {
        wave: 'sawtooth',
        hz: keyHz(key, 4, 3),
        toHz: keyHz(key, 4, 2),
        glide: 0.2,
        detune: 12 * side,
        gain: 0.12 * level,
        attack: 0.002,
        hold: 0.1,
        release: 0.5,
        filter: brass,
        pan: 0.35 * side,
      });
    });
    playTone(out, body, {
      wave: 'sawtooth',
      hz: keyHz(key, 0, 4),
      toHz: keyHz(key, 0, 3),
      glide: 0.2,
      gain: 0.1 * level,
      attack: 0.002,
      hold: 0.08,
      release: 0.45,
      filter: { type: 'lowpass', hz: 7000, toHz: 1200, glide: 0.4, q: 1.5 },
    });
    playTone(out, body, {
      wave: 'sine',
      hz: 190,
      toHz: keyHz(key, 0, 0),
      glide: 0.4,
      gain: 0.25 * level,
      attack: 0.002,
      hold: 0.15,
      release: 0.8,
    });
    playNoise(out, body, {
      gain: 0.2 * level,
      attack: 0.002,
      hold: 0.05,
      release: 1,
      filter: { type: 'lowpass', hz: 6000, toHz: 400, glide: 0.8 },
    });
    for (const [after, gain, pan] of [
      [0.05, 0.15, 0],
      [0.22, 0.1, 0.3],
      [0.45, 0.08, -0.3],
    ] as const) {
      playNoise(out, at + after, {
        gain: gain * level,
        attack: 0.04,
        hold: 0.12,
        release: 1.1,
        filter: { type: 'bandpass', hz: 900, toHz: 250, glide: 1, q: 1.2 },
        pan,
      });
    }
    playTone(out, at + aftershock, {
      wave: 'square',
      hz: keyHz(key, 0, 2),
      toHz: keyHz(key, 0, 1),
      glide: 0.25,
      gain: 0.2 * level,
      attack: 0.003,
      hold: 0.08,
      release: 0.6,
      filter: { type: 'lowpass', hz: 3000, toHz: 300, glide: 0.5 },
    });
    playNoise(out, at + aftershock, {
      gain: 0.15 * level,
      attack: 0.002,
      hold: 0.03,
      release: 0.4,
      filter: { type: 'bandpass', hz: 1500, toHz: 400, glide: 0.4, q: 0.8 },
    });
    [keyHz(key, 0, 3), keyHz(key, 4, 3), keyHz(key, 0, 4)].forEach((hz) => {
      [-1, 1].forEach((side) => {
        playTone(out, at + chordAfter, {
          wave: 'sawtooth',
          hz,
          detune: 7 * side,
          gain: 0.06 * level,
          attack: 0.05,
          hold: 0.45,
          release: 0.9,
          filter: { type: 'lowpass', hz: 4000, toHz: 1200, glide: 0.6, q: 1.2 },
          pan: 0.4 * side,
        });
      });
    });
    sparkle.degrees.forEach((degree, index) => {
      playTone(out, at + sparkle.after + index * sparkle.every, {
        wave: 'triangle',
        hz: keyHz(key, degree, sparkle.octaves[index] ?? 5),
        gain: 0.12 * level,
        attack: 0.003,
        hold: 0.03,
        release: 0.35,
        pan: index % 2 === 0 ? -0.4 : 0.4,
      });
    });
  },
  potionBounced: (out, at, variant, key) => {
    const degree = POTION.bounceDegrees[variant % POTION.bounceDegrees.length] ?? 0;
    const hz = keyHz(key, degree, 1);
    const pan = 0.5 * Math.cos(variant);
    playTone(out, at, {
      wave: 'sine',
      hz: hz * 2.2,
      toHz: hz,
      glide: 0.07,
      gain: 0.2,
      attack: 0.002,
      hold: 0.025,
      release: 0.16,
      pan,
    });
    playTone(out, at, {
      wave: 'square',
      hz: hz * 1.5,
      toHz: hz * 0.7,
      glide: 0.06,
      gain: 0.045,
      attack: 0.002,
      hold: 0.01,
      release: 0.1,
      filter: { type: 'lowpass', hz: 1400, toHz: 250, glide: 0.08 },
      pan,
    });
    playNoise(out, at, {
      gain: 0.07,
      attack: 0.001,
      hold: 0.004,
      release: 0.03,
      filter: { type: 'bandpass', hz: 3200, q: 1.2 },
      pan,
    });
    playNoise(out, at, {
      gain: 0.06,
      attack: 0.001,
      hold: 0.01,
      release: 0.08,
      filter: { type: 'lowpass', hz: 700, toHz: 200, glide: 0.08 },
      pan,
    });
  },
  // A warning more than a reward.
  bombDropped: (out, at, _variant, key) => {
    playNoise(out, at, {
      gain: 0.25,
      attack: 0.002,
      hold: 0.03,
      release: 0.18,
      filter: { type: 'lowpass', hz: 320, q: 2 },
    });
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, 0, 2),
      toHz: keyHz(key, 0, 3),
      glide: 0.35,
      gain: 0.18,
      attack: 0.01,
      hold: 0.15,
      release: 0.25,
    });
  },
  bombExploded: (out, at, _variant, key) => {
    playNoise(out, at, {
      gain: 0.36,
      attack: 0.003,
      hold: 0.08,
      release: 1.1,
      filter: { type: 'lowpass', hz: 4000, toHz: 180, glide: 1, q: 1.2 },
    });
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, 0, 3),
      toHz: keyHz(key, 0, 1),
      glide: 0.6,
      gain: 0.4,
      attack: 0.003,
      hold: 0.2,
      release: 0.7,
    });
    [0, 2, 4].forEach((degree, index) => {
      playTone(out, at + 0.12 + index * 0.05, {
        wave: 'triangle',
        hz: keyHz(key, degree, 5),
        gain: 0.06,
        attack: 0.01,
        hold: 0.25,
        release: 0.9,
      });
    });
  },
  weaponGained: (out, at, _variant, key) => {
    [0, 3, 5].forEach((degree) => {
      playTone(out, at, {
        wave: 'triangle',
        hz: keyHz(key, degree, 4),
        gain: 0.11,
        attack: 0.004,
        hold: 0.08,
        release: 0.3,
      });
    });
  },
  weaponEvolved: (out, at, _variant, key) => {
    [0, 3, 5, 7].forEach((degree, index) => {
      playTone(out, at + index * 0.04, {
        wave: 'triangle',
        hz: keyHz(key, degree, 4),
        gain: 0.1,
        attack: 0.004,
        hold: 0.15,
        release: 0.5,
      });
    });
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, 0, 5),
      gain: 0.1,
      attack: 0.004,
      hold: 0.2,
      release: 0.5,
    });
  },
  enemyYawn: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 5, 2),
      toHz: keyHz(key, 0, 2),
      glide: 0.45,
      gain: 0.2,
      attack: 0.12,
      hold: 0.12,
      release: 0.3,
      filter: { type: 'lowpass', hz: 600, toHz: 220, glide: 0.45 },
    });
    playNoise(out, at, {
      gain: 0.07,
      attack: 0.12,
      hold: 0.12,
      release: 0.3,
      filter: { type: 'lowpass', hz: 500 },
    });
  },
  enemyBottle: (out, at, _variant, key) => {
    playNoise(out, at, {
      gain: 0.16,
      attack: 0.01,
      hold: 0.03,
      release: 0.14,
      filter: { type: 'bandpass', hz: 700, toHz: 2200, glide: 0.16, q: 1.2 },
    });
    playTone(out, at + 0.02, {
      wave: 'triangle',
      hz: keyHz(key, 5, 3),
      toHz: keyHz(key, 5, 2),
      glide: 0.05,
      gain: 0.12,
      attack: 0.002,
      hold: 0.012,
      release: 0.07,
      filter: { type: 'lowpass', hz: 2600 },
    });
  },
  enemyBabble: (out, at, variant, key) => {
    const hz = keyHz(key, variant % 2 === 0 ? 3 : 5, 2);
    playNoise(out, at, {
      gain: 0.2,
      attack: 0.002,
      hold: 0.004,
      release: 0.02,
      filter: { type: 'lowpass', hz: 700 },
    });
    playTone(out, at + 0.015, {
      wave: 'sawtooth',
      hz,
      toHz: hz * 0.85,
      glide: 0.09,
      gain: 0.4,
      attack: 0.008,
      hold: 0.05,
      release: 0.05,
      filter: { type: 'bandpass', hz: 500, toHz: 900, glide: 0.09, q: 3 },
    });
  },
  enemyGrowl: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'sawtooth',
      hz: keyHz(key, 1, 1),
      toHz: keyHz(key, 0, 1),
      glide: 0.3,
      gain: 0.22,
      attack: 0.04,
      hold: 0.12,
      release: 0.2,
      filter: { type: 'lowpass', hz: 320, q: 2 },
      vibrato: { hz: 28, cents: 90, delay: 0 },
    });
  },
  bossWhistle: (out, at, _variant, key) => {
    const hz = keyHz(key, 0, 6);
    playTone(out, at, {
      wave: 'sine',
      hz,
      toHz: hz * 0.94,
      glide: 0.15,
      gain: 0.045,
      attack: 0.006,
      hold: 0.09,
      release: 0.06,
      vibrato: { hz: 31, cents: 70, delay: 0 },
    });
    playNoise(out, at, {
      gain: 0.025,
      attack: 0.006,
      hold: 0.08,
      release: 0.05,
      filter: { type: 'bandpass', hz, q: 4 },
    });
  },
  bossFeedback: (out, at, _variant, key) => {
    const hz = keyHz(key, 4, 3);
    playTone(out, at, {
      wave: 'sine',
      hz,
      toHz: hz * 1.03,
      glide: 0.6,
      gain: 0.03,
      attack: 0.25,
      hold: 0.25,
      release: 0.35,
      vibrato: { hz: 5, cents: 12, delay: 0.25 },
    });
    playNoise(out, at, {
      gain: 0.012,
      attack: 0.2,
      hold: 0.25,
      release: 0.3,
      filter: { type: 'bandpass', hz: hz * 2, q: 8 },
    });
  },
  // Wood thrown in the fire, `beatsToOne` before the 1 that burns it: a short breath as it leaves,
  // a matt knock of wood on the embers half a beat later, then a crackle growing until the 1.
  fireThrown: (out, at, beatsToOne, key, _vibes, _progress, beat = beatSeconds(MAIN_TEMPO)) => {
    tossBreath(out, at);
    const land = at + THROWN_FLIGHT_BEATS * beat;
    playTone(out, land, {
      wave: 'triangle',
      hz: keyHz(key, 0, 2) * 1.5,
      toHz: keyHz(key, 0, 2),
      glide: 0.04,
      gain: 0.16,
      attack: 0.001,
      hold: 0.01,
      release: 0.09,
      filter: { type: 'lowpass', hz: 900 },
    });
    playNoise(out, land, {
      gain: 0.1,
      attack: 0.001,
      hold: 0.006,
      release: 0.05,
      filter: { type: 'bandpass', hz: 1100, q: 2.5 },
    });
    // A 1 that catches it in flight burns it as it lands: no crackle, and the rise is cut on that 1.
    const one = at + beatsToOne * beat;
    const sparks = Math.min(40, Math.floor((one - land) / 0.07));
    for (let spark = 1; spark < sparks; spark++) {
      fireSpark(out, land + spark * 0.07, spark, 0.012 + 0.05 * (spark / sparks));
    }
    if (beatsToOne > 0) {
      flareRiser(out, Math.max(at, one - FLARE_RISER_BEATS * beat), one, key);
    }
  },
  // A ball of spores thrown at a giant: the same breath, and a soft puff as it lands.
  sporesThrown: (out, at, _variant, key, _vibes, _progress, beat = beatSeconds(MAIN_TEMPO)) => {
    tossBreath(out, at);
    const land = at + THROWN_FLIGHT_BEATS * beat;
    playNoise(out, land, {
      gain: 0.08,
      attack: 0.01,
      hold: 0.02,
      release: 0.18,
      filter: { type: 'lowpass', hz: 700, q: 0.7 },
    });
    playTone(out, land, {
      wave: 'sine',
      hz: keyHz(key, 4, 5),
      gain: 0.03,
      attack: 0.005,
      hold: 0.02,
      release: 0.4,
    });
  },
  // The light switched on: a sub boom, a bright open chord in the key whose filter opens in a quarter
  // beat as the cut flames stretch, golden bells running across with the rays, gone in two beats.
  fireBurnt: (out, at, _variant, key, _vibes, _progress, beat = beatSeconds(MAIN_TEMPO)) => {
    const quarter = beat / 4;
    const fade = 2.6 * beat;
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, 0, 2),
      toHz: keyHz(key, 0, 0),
      glide: 0.16,
      gain: 0.38,
      attack: 0.003,
      hold: 0.08,
      release: 0.85,
    });
    for (const [degree, octave, pan] of FLARE_CHORD) {
      for (const detune of [-11, 11]) {
        playTone(out, at, {
          wave: 'sawtooth',
          hz: keyHz(key, degree, octave),
          detune,
          gain: 0.042,
          attack: 0.006,
          hold: 0.18,
          release: fade - 0.18,
          pan: pan + detune / 60,
          filter: { type: 'lowpass', hz: 420, toHz: 5200, glide: quarter, q: 1.3 },
        });
      }
      playTone(out, at, {
        wave: 'triangle',
        hz: keyHz(key, degree, octave),
        gain: 0.05,
        attack: 0.006,
        hold: 0.3,
        release: fade + beat,
        pan,
      });
    }
    playNoise(out, at, {
      gain: 0.06,
      attack: 0.004,
      hold: 0.05,
      release: 0.9,
      filter: { type: 'highpass', hz: 6500, q: 0.7 },
    });
    FLARE_BELLS.forEach((degree, index) => {
      const when = at + quarter * 0.5 + index * quarter * 0.75;
      const pan = -0.75 + (1.5 * index) / (FLARE_BELLS.length - 1);
      playTone(out, when, {
        wave: 'sine',
        hz: keyHz(key, degree, 5),
        gain: 0.1 * (1 - index / 9),
        attack: 0.002,
        hold: 0.02,
        release: 0.9,
        pan,
      });
      playTone(out, when, {
        wave: 'sine',
        hz: keyHz(key, degree + 7, 5),
        gain: 0.03,
        attack: 0.002,
        hold: 0.01,
        release: 0.3,
        pan,
      });
    });
  },
  // A torch swung through the air: a warm whoosh that opens and closes, and the flame's crackle.
  fireSwing: (out, at) => {
    playNoise(out, at, {
      gain: 0.26,
      attack: 0.05,
      hold: 0.04,
      release: 0.18,
      filter: { type: 'bandpass', hz: 220, toHz: 900, glide: 0.12, q: 0.8 },
    });
    playNoise(out, at + 0.03, {
      gain: 0.05,
      attack: 0.02,
      hold: 0.05,
      release: 0.12,
      filter: { type: 'highpass', hz: 3200, q: 0.7 },
    });
  },
  // A litter picker's plastic jaws snapping shut: a dry click on a short knock of the scale.
  pinceClack: (out, at, _variant, key) => {
    playNoise(out, at, {
      gain: 0.16,
      attack: 0.001,
      hold: 0.004,
      release: 0.03,
      filter: { type: 'bandpass', hz: 2600, q: 3 },
    });
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 4, 5) * 1.4,
      toHz: keyHz(key, 4, 5),
      glide: 0.015,
      gain: 0.08,
      attack: 0.001,
      hold: 0.005,
      release: 0.06,
    });
  },
  giantWoken: (out, at, _variant, key) => {
    const hz = keyHz(key, 0, 3);
    for (const [ratio, gain, release, pan] of [
      [1, 0.09, 4, -0.2],
      [1.004, 0.07, 4, 0.2],
      [2.76, 0.04, 2.5, -0.35],
      [5.4, 0.02, 1.4, 0.35],
    ] as const) {
      playTone(out, at, {
        wave: 'sine',
        hz: hz * ratio,
        gain,
        attack: 0.008,
        hold: 0.05,
        release,
        pan,
      });
    }
    for (const [degree, pan] of [
      [0, -0.3],
      [2, 0],
      [4, 0.3],
    ] as const) {
      playTone(out, at + 0.05, {
        wave: 'triangle',
        hz: keyHz(key, degree, 4),
        gain: 0.025,
        attack: 0.5,
        hold: 0.6,
        release: 1.2,
        pan,
        filter: { type: 'lowpass', hz: 1800, q: 0.7 },
      });
    }
  },
  bossGust: (out, at) => {
    playNoise(out, at, {
      gain: 0.06,
      attack: 0.35,
      hold: 0.3,
      release: 0.6,
      filter: { type: 'bandpass', hz: 400, toHz: 1400, glide: 0.7, q: 1.2 },
    });
    playNoise(out, at + 0.1, {
      gain: 0.03,
      attack: 0.3,
      hold: 0.2,
      release: 0.5,
      filter: { type: 'lowpass', hz: 300, toHz: 180, glide: 0.8, q: 0.8 },
    });
  },
  bossThunder: (out, at, _variant, key) => {
    const hz = keyHz(key, 0, 1);
    playNoise(out, at, {
      gain: 0.08,
      attack: 0.12,
      hold: 0.3,
      release: 0.7,
      filter: { type: 'lowpass', hz: 220, toHz: 90, glide: 0.9, q: 1.4 },
    });
    playTone(out, at + 0.05, {
      wave: 'triangle',
      hz,
      toHz: hz * 0.75,
      glide: 0.8,
      gain: 0.05,
      attack: 0.08,
      hold: 0.25,
      release: 0.6,
      filter: { type: 'lowpass', hz: 200 },
    });
  },
  vibesStolen: (out, at, _variant, key) => {
    [0, 3, 7].forEach((degree, index) => {
      playTone(out, at + index * 0.05, {
        wave: 'square',
        hz: keyHz(key, degree, 3),
        gain: 0.1,
        attack: 0.003,
        hold: 0.03,
        release: 0.06,
        filter: { type: 'lowpass', hz: 1100 },
      });
    });
  },
  dashed: (out, at) => {
    playNoise(out, at, {
      gain: 0.12,
      attack: 0.01,
      hold: 0.03,
      release: 0.08,
      filter: { type: 'bandpass', hz: 1800, q: 1.2 },
    });
  },
  dashEmpty: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, 0, 2),
      gain: 0.16,
      attack: 0.002,
      hold: 0.01,
      release: 0.06,
    });
  },
  dashBack: (out, at, degree, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, degree, 5),
      gain: 0.07,
      attack: 0.003,
      hold: 0.03,
      release: 0.18,
    });
  },
  bystanderHelped: (out, at, _variant, key) => {
    [3, 5, 7, 10].forEach((degree, index) => {
      const hz = keyHz(key, degree, 5);
      playTone(out, at + index * 0.06, {
        wave: 'sine',
        hz,
        gain: 0.1,
        attack: 0.002,
        hold: 0.02,
        release: 0.4,
      });
      playTone(out, at + index * 0.06, {
        wave: 'sine',
        hz: hz * 2.76,
        gain: 0.03,
        attack: 0.002,
        hold: 0.005,
        release: 0.15,
      });
    });
  },
  bystanderLost: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 4, 4),
      toHz: keyHz(key, 2, 4),
      glide: 0.3,
      gain: 0.14,
      attack: 0.02,
      hold: 0.1,
      release: 0.3,
      filter: { type: 'lowpass', hz: 1400, toHz: 600, glide: 0.4 },
    });
  },
  volumeUp: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, 0, 0),
      toHz: keyHz(key, 0, 1),
      glide: 0.35,
      gain: 0.4,
      attack: 0.05,
      hold: 0.1,
      release: 0.2,
    });
  },
  skillCharge: (out, at, _variant, key) => {
    playNoise(out, at, {
      gain: 0.6,
      attack: 0.02,
      hold: 0.1,
      release: 0.33,
      filter: { type: 'bandpass', hz: 700, toHz: 3200, glide: 0.12, q: 1.2 },
    });
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 0, 4),
      toHz: keyHz(key, 4, 4),
      glide: 0.1,
      gain: 0.14,
      attack: 0.005,
      hold: 0.1,
      release: 0.31,
    });
  },
  skillHeal: (out, at, _variant, key) => {
    [0, 2, 4].forEach((degree, index) => {
      playTone(out, at + index * 0.03, {
        wave: 'sine',
        hz: keyHz(key, degree, 4),
        gain: 0.12,
        attack: 0.03,
        hold: 0.1,
        release: 0.45,
      });
    });
  },
  // A wave that crosses from left to right, under a rising fifth.
  skillOla: (out, at, _variant, key) => {
    [-0.8, -0.3, 0.3, 0.8].forEach((pan, index) => {
      playNoise(out, at + index * 0.065, {
        gain: 0.498,
        attack: 0.08,
        hold: 0,
        release: 0.12,
        pan,
        filter: { type: 'bandpass', hz: 500 + index * 500, toHz: 3800, glide: 0.2, q: 1.2 },
      });
    });
    playTone(out, at + 0.05, {
      wave: 'triangle',
      hz: keyHz(key, 0, 4),
      toHz: keyHz(key, 4, 4),
      glide: 0.24,
      gain: 0.149,
      attack: 0.04,
      hold: 0.1,
      release: 0.18,
    });
  },
  skillGong: (out, at, _variant, key) => {
    const root = keyHz(key, 0, 2);
    playNoise(out, at, {
      gain: 0.39,
      attack: 0.002,
      hold: 0,
      release: 0.06,
      filter: { type: 'lowpass', hz: 900 },
    });
    for (const [ratio, gain, decay, pan, detune] of [
      [0.5, 0.284, 0.5, 0, 0],
      [1, 0.302, 0.6, -0.15, -5],
      [1, 0.302, 0.6, 0.15, 5],
      [1.5, 0.355, 0.46, -0.25, 0],
      [2.13, 0.32, 0.38, 0.25, 0],
      [2.79, 0.249, 0.32, -0.25, 0],
      [3.61, 0.178, 0.26, 0.25, 0],
      [4.53, 0.124, 0.2, -0.25, 0],
      [5.92, 0.078, 0.15, 0.25, 0],
    ] as const) {
      playTone(out, at, {
        wave: 'sine',
        hz: root * ratio * (ratio > 1 ? 0.99 : 0.985),
        toHz: root * ratio,
        glide: 0.2,
        gain,
        attack: 0.004,
        hold: 0,
        release: decay,
        pan,
        detune,
      });
    }
    for (const [ratio, pan] of [
      [24, -0.4],
      [24.1, 0.4],
      [32, 0.3],
      [32.13, -0.3],
    ] as const) {
      playTone(out, at + 0.08, {
        wave: 'sine',
        hz: root * ratio,
        gain: 0.064,
        attack: 0.2,
        hold: 0,
        release: 0.32,
        pan,
      });
    }
  },
  taunted: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'sawtooth',
      hz: keyHz(key, 0, 1),
      toHz: keyHz(key, 1, 1),
      glide: 0.3,
      gain: 0.2,
      attack: 0.03,
      hold: 0.25,
      release: 0.2,
      filter: { type: 'lowpass', hz: 360, q: 2 },
      vibrato: { hz: 6, cents: 25, delay: 0.1 },
    });
  },
  playerHealed: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, 5, 5),
      toHz: keyHz(key, 5, 5) * 1.35,
      glide: 0.07,
      gain: 0.12,
      attack: 0.002,
      hold: 0.01,
      release: 0.1,
    });
  },
  playerDowned: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 3, 3),
      toHz: keyHz(key, 3, 2),
      glide: 0.4,
      gain: 0.2,
      attack: 0.01,
      hold: 0.08,
      release: 0.3,
      filter: { type: 'lowpass', hz: 700, toHz: 180, glide: 0.4 },
    });
    playNoise(out, at + 0.3, {
      gain: 0.18,
      attack: 0.002,
      hold: 0.01,
      release: 0.12,
      filter: { type: 'lowpass', hz: 300 },
    });
  },
  playerRevived: (out, at, _variant, key) => {
    [0, 4, 7].forEach((degree, index) => {
      const hz = keyHz(key, degree, 5);
      playTone(out, at + index * 0.07, {
        wave: 'sine',
        hz,
        gain: 0.1,
        attack: 0.002,
        hold: 0.02,
        release: 0.6,
      });
      playTone(out, at + index * 0.07, {
        wave: 'sine',
        hz: hz * 2.76,
        gain: 0.03,
        attack: 0.002,
        hold: 0.005,
        release: 0.2,
      });
    });
  },
  playerReviving: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, 4, 5),
      gain: 0.07,
      attack: 0.002,
      hold: 0.005,
      release: 0.05,
    });
  },
  seatTaken: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 4, 5),
      gain: 0.14,
      attack: 0.004,
      hold: 0.04,
      release: 0.25,
    });
  },
  seatFreed: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 2, 4),
      toHz: keyHz(key, 0, 4),
      glide: 0.15,
      gain: 0.12,
      attack: 0.004,
      hold: 0.04,
      release: 0.25,
    });
  },
  launch: (out, at, _variant, key) => {
    for (const degree of [0, 4, 7]) {
      playTone(out, at, {
        wave: 'sawtooth',
        hz: keyHz(key, degree, 3),
        toHz: keyHz(key, degree, 5),
        glide: 0.9,
        gain: 0.07,
        attack: 0.05,
        hold: 0.85,
        release: 0.3,
        filter: { type: 'lowpass', hz: 400, toHz: 5500, glide: 0.9, q: 5 },
      });
    }
    playNoise(out, at, {
      gain: 0.14,
      attack: 0.8,
      hold: 0.1,
      release: 0.3,
      filter: { type: 'highpass', hz: 300, toHz: 5000, glide: 0.9 },
    });
  },
};

export interface Sfx {
  play(
    events: readonly SimEvent[],
    now: number,
    players?: readonly SfxPlayer[],
    core?: SfxCore,
    enemies?: readonly SfxEnemy[],
    // The sim's tick of these events: the sfx clock drifts from it.
    tick?: number,
  ): void;
  cue(cue: Cue, now: number, variant?: number): void;
  beginFrame(): void;
  setHitSound(enabled: boolean): void;
  setKey(key: SfxKey): void;
  setTempo(tempo: Tempo): void;
  // null when no set plays; the vibes fall on its sixteenths.
  setClock(anchor: Anchor | null): void;
}

function levelProgress(player: SfxPlayer | undefined): number {
  const needed = player?.vibesToNextLevel ?? 0;
  return needed > 0 ? Math.min((player?.vibes ?? 0) / needed, 1) : 0;
}

function variantOf(event: SimEvent, core: SfxCore, enemies: readonly SfxEnemy[]): number {
  if (event.type === 'coreHit') {
    return coreHitDegree(core);
  }
  if (event.type === 'enemyHit') {
    return enemyHitDegree(enemies.find((enemy) => enemy.id === event.id));
  }
  if (event.type === 'batteryPlugged') {
    return event.index;
  }
  if (event.type === 'potionBounced') {
    return event.enemyId;
  }
  return 'id' in event ? event.id : 0;
}

export function createSfx(
  out: AudioNode,
  trapEffectOf: TrapEffectOf,
  lookups: SfxLookups = {},
  initialKey: SfxKey = SOIREE_OUVERTURE,
  samples: SfxSamples = NO_SAMPLES,
): Sfx {
  let key = initialKey;
  let limiter = createSfxLimiter(SFX_LIMITS);
  // The voice of a sound the limiter lets through: the artist's file once decoded, in the key of the
  // track, its synth voice otherwise. A shot of an attack kind tries its kind's file first.
  const acquire = (name: SfxName, now: number, attackKind?: string): Voice | null => {
    const file =
      (attackKind === undefined ? undefined : samples.shot(attackKind, key)) ??
      samples.sound(name, key);
    return limiter.tryAcquire(name, now, file?.seconds) ? (file?.play ?? VOICES[name]) : null;
  };
  let tempo = MAIN_TEMPO;
  let clock: Anchor | null = null;
  let progress = 0;
  let hitSound = true;
  const arp = createVibeArp();
  // The root of the chord the set plays at `now`.
  const chordRootNow = (now: number): number =>
    chordRootOfBar(key.chords, clock === null ? 0 : barOfTick(timeToTick(clock, now), tempo));
  // Beats from `now` to the next 1, when the offerings thrown in burn.
  const beatsToOne = (now: number): number =>
    clock === null
      ? BEATS_PER_BAR
      : (tempo.ticksPerBar - ticksIntoBar(timeToTick(clock, now), tempo)) / tempo.ticksPerBeat;
  const variantAt = (
    name: SfxName,
    event: SimEvent,
    events: readonly SimEvent[],
    now: number,
    core: SfxCore,
    enemies: readonly SfxEnemy[],
    tick: number | undefined,
  ): number => {
    const variant = EVENT_VARIANTS[name];
    if (variant !== undefined) {
      return variant(event, tick, tempo);
    }
    if (event.type === 'dashBack') {
      return chordRootNow(now) + 4;
    }
    if (event.type === 'vibesMilestone') {
      return chordRootNow(now);
    }
    if (event.type === 'offeringThrown') {
      // Thrown on the 1 itself, it burns in the same step.
      const burnt = events.some(
        (other) => other.type === 'offeringBurnt' && other.site === event.site,
      );
      return burnt ? 0 : beatsToOne(now);
    }
    return variantOf(event, core, enemies);
  };
  return {
    play(events, now, players = [], core = FULL_CORE, enemies = [], tick) {
      let vibes = 0;
      for (const event of events) {
        const name = sfxOf(event, trapEffectOf, lookups, players);
        if (name === 'enemyHit' && !hitSound) {
          continue;
        }
        if (event.type === 'pickupCollected') {
          vibes += 1;
          progress = levelProgress(players.find((player) => player.id === event.playerId));
          continue;
        }
        const attackKind =
          name === 'playerFired' ? firedAttackKind(event, lookups, players) : undefined;
        const voice = name === null ? null : acquire(name, now, attackKind);
        if (name !== null && voice !== null) {
          const variant = variantAt(name, event, events, now, core, enemies, tick);
          voice(out, now, variant, key, undefined, undefined, beatSeconds(tempo));
        } else if (event.type === 'bar') {
          for (const enemy of enemies) {
            const call = enemy.kind === undefined ? undefined : BOSS_BAR_CALLS.get(enemy.kind);
            const bossCall = call === undefined ? null : acquire(call, now);
            bossCall?.(out, now, 0, key);
          }
        }
      }
      const note = arp.collect(vibes, now, tempo, clock);
      const arpVoice = note === null ? null : acquire('vibesCollected', note.at);
      if (note !== null && arpVoice !== null) {
        const degree = chordRootOfBar(key.chords, note.bar) + note.degree;
        arpVoice(out, note.at, degree, key, note.vibes, progress);
      }
    },
    cue(cue, now, variant = 0) {
      acquire(cue, now)?.(out, now, variant, key, undefined, undefined, beatSeconds(tempo));
    },
    beginFrame() {
      limiter.beginFrame();
    },
    setHitSound(enabled) {
      hitSound = enabled;
    },
    setKey(next) {
      key = next;
    },
    setTempo(next) {
      if (next.ticksPerBeat !== tempo.ticksPerBeat) {
        limiter = createSfxLimiter(sfxLimitsFor(next));
      }
      // A stage entered from its path keeps the path's beat but starts its bars at its own tick.
      tempo = next;
    },
    setClock(anchor) {
      clock = anchor;
    },
  };
}

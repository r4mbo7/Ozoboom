import { SOIREE_OUVERTURE } from '../data/tracks';
import type { MusicTrack } from '../data/types';
import type { SimEvent } from '../sim/state';
import type { Cue } from './types';
import { MAIN_TEMPO, type Tempo, barOfTick } from '../shared/tempo';
import { beatSeconds, timeToTick, type Anchor } from './clock';
import { chordRootOfBar, keyHz, type MusicKey } from './scale';
import { playNoise, playTone } from './synth';
import { createVibeArp } from './vibe-arp';
import { FULL_BAR_CALLS, FULL_EVENT_CALLS } from './full';

export type SfxName =
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
  | 'fireBurnt'
  | 'giantWoken'
  | 'vibesStolen'
  | 'playerShoved'
  | 'bystanderHelped'
  | 'bystanderLost'
  | 'lootDropped'
  | 'lootCollected'
  | 'vibesCollected'
  | 'bombDropped'
  | 'bombExploded'
  | 'volumeUp'
  | 'skillCharge'
  | 'skillHeal'
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
  | 'dashBack';

export interface SfxLimit {
  perFrame: number;
  concurrent: number;
  seconds: number;
}

export interface SfxLimiter {
  beginFrame(): void;
  tryAcquire(name: SfxName, now: number): boolean;
}

export type TrapEffectOf = (kind: string) => string;

export interface SfxLookups {
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

// A continuous weapon would sound every tick on `weaponFired`: it sounds when it touches a bad vibe.
const WEAPON_HIT_SFX: ReadonlyMap<string, SfxName> = new Map<string, SfxName>(
  Object.entries<SfxName>({
    orbit: 'weaponFans',
  }),
);

const SKILL_SFX: ReadonlyMap<string, SfxName> = new Map<string, SfxName>(
  Object.entries<SfxName>({
    nova: 'skillUsed',
    dash: 'skillCharge',
    healPulse: 'skillHeal',
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
    skillUsed: { perFrame: 1, concurrent: 2, seconds: 0.3 },
    gameWon: { perFrame: 1, concurrent: 1, seconds: 2 },
    gameLost: { perFrame: 1, concurrent: 1, seconds: 2 },
    weaponSweep: { perFrame: 1, concurrent: 2, seconds: 0.2 },
    weaponSpark: { perFrame: 1, concurrent: 3, seconds: 0.07 },
    weaponHoop: { perFrame: 1, concurrent: 2, seconds: 0.22 },
    weaponDiabolo: { perFrame: 1, concurrent: 2, seconds: 0.3 },
    weaponFrisbee: { perFrame: 1, concurrent: 2, seconds: 0.3 },
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
    fireBurnt: { perFrame: 1, concurrent: 2, seconds: 0.4 },
    giantWoken: { perFrame: 1, concurrent: 2, seconds: 1 },
    vibesStolen: { perFrame: 1, concurrent: 2, seconds: 0.25 },
    playerShoved: { perFrame: 1, concurrent: 2, seconds: 0.2 },
    bystanderHelped: { perFrame: 1, concurrent: 2, seconds: 0.6 },
    bystanderLost: { perFrame: 1, concurrent: 1, seconds: 0.5 },
    lootDropped: { perFrame: 1, concurrent: 2, seconds: 0.4 },
    lootCollected: { perFrame: 1, concurrent: 2, seconds: 0.35 },
    vibesCollected: { perFrame: 1, concurrent: 2, seconds: 0.15 },
    bombDropped: { perFrame: 1, concurrent: 1, seconds: 0.5 },
    bombExploded: { perFrame: 1, concurrent: 1, seconds: 1.6 },
    volumeUp: { perFrame: 1, concurrent: 1, seconds: 0.6 },
    skillCharge: { perFrame: 1, concurrent: 2, seconds: 0.3 },
    skillHeal: { perFrame: 1, concurrent: 2, seconds: 0.7 },
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
  };
}

const SFX_LIMITS = sfxLimitsFor(MAIN_TEMPO);

export function sfxOf(
  event: SimEvent,
  trapEffectOf: TrapEffectOf,
  lookups: SfxLookups = {},
  players: readonly SfxPlayer[] = [],
): SfxName | null {
  switch (event.type) {
    case 'playerFired':
    case 'enemyHit':
    case 'enemyDied':
    case 'coreHit':
    case 'gameWon':
    case 'gameLost':
    case 'weaponGained':
    case 'weaponEvolved':
    case 'vibesStolen':
    case 'playerShoved':
    case 'bystanderHelped':
    case 'bystanderLost':
    case 'taunted':
    case 'playerHealed':
    case 'playerDowned':
    case 'playerRevived':
    case 'playerReviving':
    case 'lootDropped':
    case 'lootCollected':
    case 'bombDropped':
    case 'bombExploded':
      return event.type;
    case 'pickupCollected':
      return 'vibesCollected';
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
    case 'enemyYawned':
      return 'enemyYawn';
    case 'enemyShot':
      return lookups.specialKindOf?.(event.kind) === 'bottle' ? 'enemyBottle' : null;
    case 'enemyBabbled':
      return 'enemyBabble';
    case 'enemyRevived':
      return 'enemyGrowl';
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
    tryAcquire(name, now) {
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
      sounding.push(now + limit.seconds);
      playedThisFrame.set(name, played + 1);
      return true;
    },
  };
}

type Voice = (
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
const DEALT_DEGREES = [0, 2, 4, 5];
const FANS_DEGREES = [0, 2, 4, 2, 5, 4];

const VOICES: Readonly<Record<SfxName, Voice>> = {
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
      gain: 0.1,
      attack: 0.01,
      hold: 0.12,
      release: 0.15,
      filter: { type: 'lowpass', hz: 800, toHz: 5000, glide: 0.2, q: 4 },
    });
    playNoise(out, at, {
      gain: 0.12,
      attack: 0.08,
      hold: 0.05,
      release: 0.15,
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
      hz: keyHz(key, 0, 5),
      toHz: keyHz(key, 5, 5),
      glide: 0.24,
      gain: 0.13,
      attack: 0.01,
      hold: 0.2,
      release: 0.06,
      vibrato: { hz: 9, cents: 25, delay: 0.05 },
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
  lootDropped: (out, at, _variant, key) => {
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
  lootCollected: (out, at, _variant, key) => {
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
  fireBurnt: (out, at) => {
    playNoise(out, at, {
      gain: 0.09,
      attack: 0.03,
      hold: 0.12,
      release: 0.5,
      filter: { type: 'bandpass', hz: 300, toHz: 1600, glide: 0.4, q: 1.1 },
    });
    for (let spark = 0; spark < 7; spark++) {
      const scatter = Math.abs(Math.sin((at + spark) * 78.233) * 43_758.545) % 1;
      playNoise(out, at + 0.12 + spark * 0.07 + scatter * 0.05, {
        gain: 0.06 * (1 - spark / 9),
        attack: 0.001,
        hold: 0.004,
        release: 0.03,
        pan: scatter * 1.2 - 0.6,
        filter: { type: 'highpass', hz: 3500, q: 0.7 },
      });
    }
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
  playerShoved: (out, at, _variant, key) => {
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, 0, 1),
      toHz: keyHz(key, 0, 0),
      glide: 0.1,
      gain: 0.3,
      attack: 0.002,
      hold: 0.02,
      release: 0.1,
    });
    playNoise(out, at, {
      gain: 0.22,
      attack: 0.002,
      hold: 0.01,
      release: 0.07,
      filter: { type: 'lowpass', hz: 500 },
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
      gain: 0.4,
      attack: 0.02,
      hold: 0.03,
      release: 0.1,
      filter: { type: 'bandpass', hz: 700, toHz: 3200, glide: 0.12, q: 1.2 },
    });
    playTone(out, at, {
      wave: 'triangle',
      hz: keyHz(key, 0, 4),
      toHz: keyHz(key, 4, 4),
      glide: 0.1,
      gain: 0.08,
      attack: 0.005,
      hold: 0.05,
      release: 0.08,
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
  return 'id' in event ? event.id : 0;
}

export function createSfx(
  out: AudioNode,
  trapEffectOf: TrapEffectOf,
  lookups: SfxLookups = {},
  initialKey: SfxKey = SOIREE_OUVERTURE,
): Sfx {
  let key = initialKey;
  let limiter = createSfxLimiter(SFX_LIMITS);
  let tempo = MAIN_TEMPO;
  let clock: Anchor | null = null;
  let progress = 0;
  let hitSound = true;
  const arp = createVibeArp();
  return {
    play(events, now, players = [], core = FULL_CORE, enemies = []) {
      let vibes = 0;
      for (const event of events) {
        const name = sfxOf(event, trapEffectOf, lookups, players);
        if (name === 'enemyHit' && !hitSound) {
          continue;
        }
        if (event.type === 'pickupCollected') {
          vibes += 1;
          progress = levelProgress(players.find((player) => player.id === event.playerId));
        } else if (name !== null && limiter.tryAcquire(name, now)) {
          const variant =
            event.type === 'dashBack'
              ? chordRootOfBar(
                  key.chords,
                  clock === null ? 0 : barOfTick(timeToTick(clock, now), tempo),
                ) + 4
              : variantOf(event, core, enemies);
          VOICES[name](out, now, variant, key);
        } else if (event.type === 'bar') {
          for (const enemy of enemies) {
            const call = enemy.kind === undefined ? undefined : BOSS_BAR_CALLS.get(enemy.kind);
            if (call !== undefined && limiter.tryAcquire(call, now)) {
              VOICES[call](out, now, 0, key);
            }
          }
        }
      }
      const note = arp.collect(vibes, now, tempo, clock);
      if (note !== null && limiter.tryAcquire('vibesCollected', note.at)) {
        const degree = chordRootOfBar(key.chords, note.bar) + note.degree;
        VOICES.vibesCollected(out, note.at, degree, key, note.vibes, progress);
      }
    },
    cue(cue, now, variant = 0) {
      if (limiter.tryAcquire(cue, now)) {
        VOICES[cue](out, now, variant, key, undefined, undefined, beatSeconds(tempo));
      }
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
        tempo = next;
        limiter = createSfxLimiter(sfxLimitsFor(next));
      }
    },
    setClock(anchor) {
      clock = anchor;
    },
  };
}

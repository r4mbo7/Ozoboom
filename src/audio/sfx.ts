import type { SimEvent } from '../sim/state';
import type { Cue } from './types';
import { DEFAULT_BPM } from '../shared/tempo';
import { degreeToHz } from './scale';
import { playNoise, playTone } from './synth';

export type SfxName =
  | 'playerFired'
  | 'enemyHit'
  | 'enemyDied'
  | 'coreHit'
  | 'trapSub'
  | 'trapBreath'
  | 'levelUp'
  | 'upgradeChosen'
  | 'skillUsed'
  | 'ultimateUsed'
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
  | 'enemySigh'
  | 'enemyBabble'
  | 'enemyGrowl'
  | 'vibesStolen'
  | 'playerShoved'
  | 'bystanderHelped'
  | 'bystanderLost'
  | 'volumeUp'
  | 'skillCharge'
  | 'skillCase'
  | 'skillHeal'
  | 'skillRecall'
  | 'taunted'
  | 'barrierBroken'
  | 'playerHealed'
  | 'playerDowned'
  | 'playerRevived'
  | 'playerReviving'
  | 'seatTaken'
  | 'seatFreed'
  | 'launch';

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

export type SkillSlot = 'skill' | 'ultimate';

export interface SkillSound {
  readonly kind: string;
  readonly revive?: boolean;
}

export interface SfxLookups {
  readonly skillSoundOf?: (classId: string, slot: SkillSlot) => SkillSound | undefined;
  readonly weaponKindOf?: (weaponId: string) => string | undefined;
  readonly specialKindOf?: (enemyKind: string) => string | undefined;
}

// The trail (monocycle) is deliberately absent: it stays silent.
const WEAPON_SFX: ReadonlyMap<string, SfxName> = new Map<string, SfxName>(
  Object.entries({
    sweep: 'weaponSweep',
    spark: 'weaponSpark',
    hoop: 'weaponHoop',
    lob: 'weaponDiabolo',
    boomerang: 'weaponFrisbee',
    plate: 'weaponPlate',
    totem: 'weaponTotem',
    orbit: 'weaponFans',
    ribbon: 'weaponRibbon',
  }) as [string, SfxName][],
);

const SKILL_SFX: ReadonlyMap<string, SfxName> = new Map<string, SfxName>(
  Object.entries({
    nova: 'skillUsed',
    laserShow: 'ultimateUsed',
    dash: 'skillCharge',
    barrier: 'skillCase',
    healPulse: 'skillHeal',
  }) as [string, SfxName][],
);

const CUE_SFX: Readonly<Record<Cue, SfxName>> = {
  seatTaken: 'seatTaken',
  seatFreed: 'seatFreed',
  launch: 'launch',
};

export interface SfxPlayer {
  readonly id: number;
  readonly classId: string;
}

const BEAT_SECONDS = 60 / DEFAULT_BPM;

export const SFX_LIMITS: Readonly<Record<SfxName, SfxLimit>> = {
  playerFired: { perFrame: 1, concurrent: 3, seconds: 0.09 },
  enemyHit: { perFrame: 2, concurrent: 4, seconds: 0.04 },
  enemyDied: { perFrame: 3, concurrent: 6, seconds: 0.24 },
  coreHit: { perFrame: 1, concurrent: 1, seconds: 0.36 },
  trapSub: { perFrame: 1, concurrent: 2, seconds: 0.3 },
  trapBreath: { perFrame: 1, concurrent: 2, seconds: 0.16 },
  levelUp: { perFrame: 1, concurrent: 1, seconds: 0.45 },
  upgradeChosen: { perFrame: 1, concurrent: 1, seconds: 0.3 },
  skillUsed: { perFrame: 1, concurrent: 2, seconds: 0.3 },
  ultimateUsed: { perFrame: 1, concurrent: 1, seconds: 1 },
  gameWon: { perFrame: 1, concurrent: 1, seconds: 2 },
  gameLost: { perFrame: 1, concurrent: 1, seconds: 2 },
  weaponSweep: { perFrame: 1, concurrent: 2, seconds: 0.2 },
  weaponSpark: { perFrame: 1, concurrent: 3, seconds: 0.07 },
  weaponHoop: { perFrame: 1, concurrent: 2, seconds: 0.22 },
  weaponDiabolo: { perFrame: 1, concurrent: 2, seconds: 0.3 },
  weaponFrisbee: { perFrame: 1, concurrent: 2, seconds: 0.3 },
  weaponPlate: { perFrame: 1, concurrent: 2, seconds: 0.4 },
  weaponTotem: { perFrame: 1, concurrent: 1, seconds: 0.5 },
  weaponFans: { perFrame: 1, concurrent: 1, seconds: 0.15 },
  weaponRibbon: { perFrame: 1, concurrent: 2, seconds: 0.3 },
  weaponGained: { perFrame: 1, concurrent: 1, seconds: 0.5 },
  weaponEvolved: { perFrame: 1, concurrent: 1, seconds: 0.8 },
  enemyYawn: { perFrame: 1, concurrent: 2, seconds: 0.6 },
  enemySigh: { perFrame: 1, concurrent: 2, seconds: 0.3 },
  enemyBabble: { perFrame: 1, concurrent: 2, seconds: 0.15 },
  enemyGrowl: { perFrame: 1, concurrent: 2, seconds: 0.35 },
  vibesStolen: { perFrame: 1, concurrent: 2, seconds: 0.25 },
  playerShoved: { perFrame: 1, concurrent: 2, seconds: 0.2 },
  bystanderHelped: { perFrame: 1, concurrent: 2, seconds: 0.6 },
  bystanderLost: { perFrame: 1, concurrent: 1, seconds: 0.5 },
  volumeUp: { perFrame: 1, concurrent: 1, seconds: 0.6 },
  skillCharge: { perFrame: 1, concurrent: 2, seconds: 0.3 },
  skillCase: { perFrame: 1, concurrent: 2, seconds: 0.4 },
  skillHeal: { perFrame: 1, concurrent: 2, seconds: 0.7 },
  skillRecall: { perFrame: 1, concurrent: 1, seconds: 2 * BEAT_SECONDS },
  taunted: { perFrame: 1, concurrent: 2, seconds: 0.5 },
  barrierBroken: { perFrame: 1, concurrent: 2, seconds: 0.5 },
  playerHealed: { perFrame: 1, concurrent: 2, seconds: 0.15 },
  playerDowned: { perFrame: 1, concurrent: 2, seconds: 0.6 },
  playerRevived: { perFrame: 1, concurrent: 2, seconds: 0.8 },
  playerReviving: { perFrame: 1, concurrent: 1, seconds: BEAT_SECONDS },
  seatTaken: { perFrame: 1, concurrent: 2, seconds: 0.4 },
  seatFreed: { perFrame: 1, concurrent: 2, seconds: 0.4 },
  launch: { perFrame: 1, concurrent: 1, seconds: 1.4 },
};

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
    case 'levelUp':
    case 'upgradeChosen':
    case 'gameWon':
    case 'gameLost':
    case 'weaponGained':
    case 'weaponEvolved':
    case 'vibesStolen':
    case 'playerShoved':
    case 'bystanderHelped':
    case 'bystanderLost':
    case 'taunted':
    case 'barrierBroken':
    case 'playerHealed':
    case 'playerDowned':
    case 'playerRevived':
    case 'playerReviving':
      return event.type;
    case 'skillUsed':
    case 'ultimateUsed': {
      const classId = players.find((player) => player.id === event.playerId)?.classId;
      const slot = event.type === 'skillUsed' ? 'skill' : 'ultimate';
      const sound = classId === undefined ? undefined : lookups.skillSoundOf?.(classId, slot);
      if (sound === undefined) {
        return null;
      }
      return sound.revive === true ? 'skillRecall' : (SKILL_SFX.get(sound.kind) ?? null);
    }
    case 'weaponFired': {
      const kind = lookups.weaponKindOf?.(event.weaponId);
      return kind === undefined ? null : (WEAPON_SFX.get(kind) ?? null);
    }
    case 'enemyYawned':
      return 'enemyYawn';
    case 'enemyShot':
      return lookups.specialKindOf?.(event.kind) === 'sigh' ? 'enemySigh' : null;
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
      return effect === 'beam' ? 'trapBreath' : null;
    }
    default:
      return null;
  }
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

type Voice = (out: AudioNode, at: number, variant: number) => void;

const DIED_DEGREES = [4, 3, 0, 5];

const VOICES: Readonly<Record<SfxName, Voice>> = {
  playerFired: (out, at) => {
    playTone(out, at, {
      wave: 'square',
      hz: degreeToHz(0, 6),
      toHz: degreeToHz(0, 5),
      glide: 0.06,
      gain: 0.1,
      attack: 0.002,
      hold: 0.01,
      release: 0.07,
      filter: { type: 'highpass', hz: 500 },
    });
  },
  enemyHit: (out, at) => {
    playNoise(out, at, {
      gain: 0.35,
      attack: 0.001,
      hold: 0.004,
      release: 0.03,
      filter: { type: 'lowpass', hz: 900, q: 1 },
    });
  },
  enemyDied: (out, at, variant) => {
    const hz = degreeToHz(DIED_DEGREES[variant % DIED_DEGREES.length] ?? 0, 3);
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
  coreHit: (out, at) => {
    for (const [offset, degree] of [
      [0, 0],
      [0.12, 1],
      [0.24, 0],
    ] as const) {
      playTone(out, at + offset, {
        wave: 'square',
        hz: degreeToHz(degree, 1),
        gain: 0.22,
        attack: 0.004,
        hold: 0.06,
        release: 0.05,
        filter: { type: 'lowpass', hz: 900, q: 3 },
      });
    }
  },
  trapSub: (out, at) => {
    playTone(out, at, {
      wave: 'sine',
      hz: degreeToHz(0, 1),
      toHz: degreeToHz(0, 0),
      glide: 0.15,
      gain: 0.45,
      attack: 0.005,
      hold: 0.05,
      release: 0.24,
    });
  },
  trapBreath: (out, at) => {
    playNoise(out, at, {
      gain: 0.07,
      attack: 0.04,
      hold: 0.04,
      release: 0.08,
      filter: { type: 'bandpass', hz: 2600, q: 0.8 },
    });
  },
  levelUp: (out, at) => {
    [0, 3, 4, 7].forEach((degree, index) => {
      playTone(out, at + index * 0.07, {
        wave: 'triangle',
        hz: degreeToHz(degree, 4),
        gain: 0.16,
        attack: 0.005,
        hold: 0.04,
        release: 0.15,
      });
    });
  },
  upgradeChosen: (out, at) => {
    [4, 7].forEach((degree, index) => {
      playTone(out, at + index * 0.09, {
        wave: 'sine',
        hz: degreeToHz(degree, 4),
        gain: 0.2,
        attack: 0.004,
        hold: 0.03,
        release: 0.2,
      });
    });
  },
  skillUsed: (out, at) => {
    playTone(out, at, {
      wave: 'sawtooth',
      hz: degreeToHz(0, 3),
      toHz: degreeToHz(0, 5),
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
  ultimateUsed: (out, at) => {
    for (const degree of [0, 4, 7]) {
      playTone(out, at, {
        wave: 'sawtooth',
        hz: degreeToHz(degree, 2),
        toHz: degreeToHz(degree, 4),
        glide: 0.6,
        gain: 0.08,
        attack: 0.05,
        hold: 0.5,
        release: 0.4,
        filter: { type: 'lowpass', hz: 400, toHz: 6000, glide: 0.6, q: 6 },
      });
    }
    playNoise(out, at, {
      gain: 0.15,
      attack: 0.5,
      hold: 0.1,
      release: 0.4,
      filter: { type: 'highpass', hz: 300, toHz: 4000, glide: 0.6 },
    });
  },
  gameWon: (out, at) => {
    [0, 4, 7, 12].forEach((semitones, index) => {
      playTone(out, at + index * 0.15, {
        wave: 'triangle',
        hz: degreeToHz(0, 4) * 2 ** (semitones / 12),
        gain: 0.14,
        attack: 0.01,
        hold: 0.2,
        release: 1.2,
      });
    });
  },
  gameLost: (out, at) => {
    [4, 2, 1, 0].forEach((degree, index) => {
      playTone(out, at + index * 0.3, {
        wave: 'triangle',
        hz: degreeToHz(degree, 3),
        toHz: degreeToHz(degree, 3) * 0.94,
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
  weaponSpark: (out, at) => {
    playTone(out, at, {
      wave: 'sine',
      hz: degreeToHz(4, 6),
      toHz: degreeToHz(4, 6) * 1.5,
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
  weaponDiabolo: (out, at) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: degreeToHz(0, 4),
      toHz: degreeToHz(4, 4),
      glide: 0.13,
      gain: 0.15,
      attack: 0.005,
      hold: 0.11,
      release: 0.02,
    });
    playTone(out, at + 0.14, {
      wave: 'triangle',
      hz: degreeToHz(4, 4),
      toHz: degreeToHz(1, 4),
      glide: 0.14,
      gain: 0.15,
      attack: 0.005,
      hold: 0.12,
      release: 0.06,
    });
  },
  weaponFrisbee: (out, at) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: degreeToHz(0, 5),
      toHz: degreeToHz(5, 5),
      glide: 0.24,
      gain: 0.13,
      attack: 0.01,
      hold: 0.2,
      release: 0.06,
      vibrato: { hz: 9, cents: 25, delay: 0.05 },
    });
  },
  weaponPlate: (out, at) => {
    const root = degreeToHz(3, 5);
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
  weaponTotem: (out, at) => {
    playTone(out, at, {
      wave: 'sine',
      hz: degreeToHz(4, 1),
      toHz: degreeToHz(4, 0),
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
  weaponFans: (out, at) => {
    playTone(out, at, {
      wave: 'sawtooth',
      hz: degreeToHz(0, 2),
      gain: 0.09,
      attack: 0.08,
      hold: 0.1,
      release: 0.12,
      filter: { type: 'lowpass', hz: 420, q: 1 },
      vibrato: { hz: 14, cents: 18, delay: 0 },
    });
    playNoise(out, at, {
      gain: 0.07,
      attack: 0.08,
      hold: 0.1,
      release: 0.12,
      filter: { type: 'bandpass', hz: 500, q: 0.7 },
    });
  },
  weaponRibbon: (out, at) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: degreeToHz(0, 6),
      toHz: degreeToHz(4, 7),
      glide: 0.26,
      gain: 0.15,
      attack: 0.01,
      hold: 0.2,
      release: 0.1,
      vibrato: { hz: 8, cents: 30, delay: 0.04 },
    });
  },
  weaponGained: (out, at) => {
    [0, 3, 5].forEach((degree) => {
      playTone(out, at, {
        wave: 'triangle',
        hz: degreeToHz(degree, 4),
        gain: 0.11,
        attack: 0.004,
        hold: 0.08,
        release: 0.3,
      });
    });
  },
  weaponEvolved: (out, at) => {
    [0, 3, 5, 7].forEach((degree, index) => {
      playTone(out, at + index * 0.04, {
        wave: 'triangle',
        hz: degreeToHz(degree, 4),
        gain: 0.1,
        attack: 0.004,
        hold: 0.15,
        release: 0.5,
      });
    });
    playTone(out, at, {
      wave: 'sine',
      hz: degreeToHz(0, 5),
      gain: 0.1,
      attack: 0.004,
      hold: 0.2,
      release: 0.5,
    });
  },
  enemyYawn: (out, at) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: degreeToHz(5, 2),
      toHz: degreeToHz(0, 2),
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
  enemySigh: (out, at) => {
    playNoise(out, at, {
      gain: 0.2,
      attack: 0.05,
      hold: 0.03,
      release: 0.22,
      filter: { type: 'lowpass', hz: 800, toHz: 250, glide: 0.25 },
    });
    playTone(out, at, {
      wave: 'triangle',
      hz: degreeToHz(3, 2),
      toHz: degreeToHz(0, 2),
      glide: 0.25,
      gain: 0.1,
      attack: 0.04,
      hold: 0.04,
      release: 0.18,
      filter: { type: 'lowpass', hz: 500 },
    });
  },
  enemyBabble: (out, at, variant) => {
    const hz = degreeToHz(variant % 2 === 0 ? 3 : 5, 2);
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
  enemyGrowl: (out, at) => {
    playTone(out, at, {
      wave: 'sawtooth',
      hz: degreeToHz(1, 1),
      toHz: degreeToHz(0, 1),
      glide: 0.3,
      gain: 0.22,
      attack: 0.04,
      hold: 0.12,
      release: 0.2,
      filter: { type: 'lowpass', hz: 320, q: 2 },
      vibrato: { hz: 28, cents: 90, delay: 0 },
    });
  },
  vibesStolen: (out, at) => {
    [0, 3, 7].forEach((degree, index) => {
      playTone(out, at + index * 0.05, {
        wave: 'square',
        hz: degreeToHz(degree, 3),
        gain: 0.1,
        attack: 0.003,
        hold: 0.03,
        release: 0.06,
        filter: { type: 'lowpass', hz: 1100 },
      });
    });
  },
  playerShoved: (out, at) => {
    playTone(out, at, {
      wave: 'sine',
      hz: degreeToHz(0, 1),
      toHz: degreeToHz(0, 0),
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
  bystanderHelped: (out, at) => {
    [3, 5, 7, 10].forEach((degree, index) => {
      const hz = degreeToHz(degree, 5);
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
  bystanderLost: (out, at) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: degreeToHz(4, 4),
      toHz: degreeToHz(2, 4),
      glide: 0.3,
      gain: 0.14,
      attack: 0.02,
      hold: 0.1,
      release: 0.3,
      filter: { type: 'lowpass', hz: 1400, toHz: 600, glide: 0.4 },
    });
  },
  volumeUp: (out, at) => {
    playTone(out, at, {
      wave: 'sine',
      hz: degreeToHz(0, 0),
      toHz: degreeToHz(0, 1),
      glide: 0.35,
      gain: 0.4,
      attack: 0.05,
      hold: 0.1,
      release: 0.2,
    });
  },
  skillCharge: (out, at) => {
    playNoise(out, at, {
      gain: 0.4,
      attack: 0.02,
      hold: 0.03,
      release: 0.1,
      filter: { type: 'bandpass', hz: 700, toHz: 3200, glide: 0.12, q: 1.2 },
    });
    playTone(out, at, {
      wave: 'triangle',
      hz: degreeToHz(0, 4),
      toHz: degreeToHz(4, 4),
      glide: 0.1,
      gain: 0.08,
      attack: 0.005,
      hold: 0.05,
      release: 0.08,
    });
  },
  skillCase: (out, at) => {
    playTone(out, at, {
      wave: 'sine',
      hz: degreeToHz(0, 1),
      toHz: degreeToHz(0, 0),
      glide: 0.12,
      gain: 0.45,
      attack: 0.002,
      hold: 0.03,
      release: 0.16,
    });
    playNoise(out, at, {
      gain: 0.2,
      attack: 0.001,
      hold: 0.008,
      release: 0.07,
      filter: { type: 'lowpass', hz: 450 },
    });
    playTone(out, at + 0.09, {
      wave: 'square',
      hz: degreeToHz(4, 3),
      gain: 0.08,
      attack: 0.001,
      hold: 0.008,
      release: 0.03,
      filter: { type: 'lowpass', hz: 1000 },
    });
  },
  skillHeal: (out, at) => {
    [0, 2, 4].forEach((degree, index) => {
      playTone(out, at + index * 0.03, {
        wave: 'sine',
        hz: degreeToHz(degree, 4),
        gain: 0.12,
        attack: 0.03,
        hold: 0.1,
        release: 0.45,
      });
    });
  },
  skillRecall: (out, at) => {
    [0, 2, 4, 7, 9].forEach((degree, index) => {
      playTone(out, at + index * 0.2, {
        wave: 'triangle',
        hz: degreeToHz(degree, 4),
        gain: 0.12,
        attack: 0.004,
        hold: 0.05,
        release: 0.3,
      });
      playTone(out, at + index * 0.2, {
        wave: 'sine',
        hz: degreeToHz(degree, 5),
        gain: 0.04,
        attack: 0.004,
        hold: 0.02,
        release: 0.2,
      });
    });
  },
  taunted: (out, at) => {
    playTone(out, at, {
      wave: 'sawtooth',
      hz: degreeToHz(0, 1),
      toHz: degreeToHz(1, 1),
      glide: 0.3,
      gain: 0.2,
      attack: 0.03,
      hold: 0.25,
      release: 0.2,
      filter: { type: 'lowpass', hz: 360, q: 2 },
      vibrato: { hz: 6, cents: 25, delay: 0.1 },
    });
  },
  barrierBroken: (out, at) => {
    playTone(out, at, {
      wave: 'sawtooth',
      hz: degreeToHz(3, 2),
      toHz: degreeToHz(0, 1),
      glide: 0.3,
      gain: 0.12,
      attack: 0.005,
      hold: 0.08,
      release: 0.18,
      filter: { type: 'lowpass', hz: 700, toHz: 200, glide: 0.3, q: 3 },
    });
    playNoise(out, at + 0.02, {
      gain: 0.3,
      attack: 0.002,
      hold: 0.03,
      release: 0.25,
      filter: { type: 'lowpass', hz: 900, toHz: 250, glide: 0.3 },
    });
  },
  playerHealed: (out, at) => {
    playTone(out, at, {
      wave: 'sine',
      hz: degreeToHz(5, 5),
      toHz: degreeToHz(5, 5) * 1.35,
      glide: 0.07,
      gain: 0.12,
      attack: 0.002,
      hold: 0.01,
      release: 0.1,
    });
  },
  playerDowned: (out, at) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: degreeToHz(3, 3),
      toHz: degreeToHz(3, 2),
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
  playerRevived: (out, at) => {
    [0, 4, 7].forEach((degree, index) => {
      const hz = degreeToHz(degree, 5);
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
  playerReviving: (out, at) => {
    playTone(out, at, {
      wave: 'sine',
      hz: degreeToHz(4, 5),
      gain: 0.07,
      attack: 0.002,
      hold: 0.005,
      release: 0.05,
    });
  },
  seatTaken: (out, at) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: degreeToHz(4, 5),
      gain: 0.14,
      attack: 0.004,
      hold: 0.04,
      release: 0.25,
    });
  },
  seatFreed: (out, at) => {
    playTone(out, at, {
      wave: 'triangle',
      hz: degreeToHz(2, 4),
      toHz: degreeToHz(0, 4),
      glide: 0.15,
      gain: 0.12,
      attack: 0.004,
      hold: 0.04,
      release: 0.25,
    });
  },
  launch: (out, at) => {
    for (const degree of [0, 4, 7]) {
      playTone(out, at, {
        wave: 'sawtooth',
        hz: degreeToHz(degree, 3),
        toHz: degreeToHz(degree, 5),
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
  play(events: readonly SimEvent[], now: number, players?: readonly SfxPlayer[]): void;
  cue(cue: Cue, now: number): void;
  beginFrame(): void;
}

export function createSfx(
  out: AudioNode,
  trapEffectOf: TrapEffectOf,
  lookups: SfxLookups = {},
): Sfx {
  const limiter = createSfxLimiter(SFX_LIMITS);
  return {
    play(events, now, players = []) {
      for (const event of events) {
        const name = sfxOf(event, trapEffectOf, lookups, players);
        if (name !== null && limiter.tryAcquire(name, now)) {
          VOICES[name](out, now, 'id' in event ? event.id : 0);
        }
      }
    },
    cue(cue, now) {
      const name = CUE_SFX[cue];
      if (limiter.tryAcquire(name, now)) {
        VOICES[name](out, now, 0);
      }
    },
    beginFrame() {
      limiter.beginFrame();
    },
  };
}

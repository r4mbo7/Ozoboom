import type { SimEvent } from '../sim/state';
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
  | 'gameLost';

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
};

export function sfxOf(event: SimEvent, trapEffectOf: TrapEffectOf): SfxName | null {
  switch (event.type) {
    case 'playerFired':
    case 'enemyHit':
    case 'enemyDied':
    case 'coreHit':
    case 'levelUp':
    case 'upgradeChosen':
    case 'skillUsed':
    case 'ultimateUsed':
    case 'gameWon':
    case 'gameLost':
      return event.type;
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
};

export interface Sfx {
  play(events: readonly SimEvent[], now: number): void;
  beginFrame(): void;
}

export function createSfx(out: AudioNode, trapEffectOf: TrapEffectOf): Sfx {
  const limiter = createSfxLimiter(SFX_LIMITS);
  return {
    play(events, now) {
      for (const event of events) {
        const name = sfxOf(event, trapEffectOf);
        if (name !== null && limiter.tryAcquire(name, now)) {
          VOICES[name](out, now, 'id' in event ? event.id : 0);
        }
      }
    },
    beginFrame() {
      limiter.beginFrame();
    },
  };
}

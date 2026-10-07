import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import { STEP_TICKS, TICK_SECONDS } from './clock';
import { keyHz, type MusicKey } from './scale';
import { playNoise, playTone } from './synth';

export const SPEAKER_LAYER_IDS = ['dome-chill', 'foret', 'sub', 'cercle-acid'] as const;
export type SpeakerLayerId = (typeof SPEAKER_LAYER_IDS)[number];

export const MUFFLED_HZ = 260;
export const MUFFLED_LEVEL = 0.3;
export const OPEN_TICKS = TICKS_PER_BAR;
export const BREAK_LEVEL = 0.5;
export const BREAK_OPEN = 0.6;

const SIXTEENTH = STEP_TICKS * TICK_SECONDS;
const BAR_SECONDS = TICKS_PER_BAR * TICK_SECONDS;

export interface Presence {
  level: number;
  open: number;
}

export interface VoiceContext {
  out: AudioNode;
  at: number;
  bar: number;
  sixteenth: number;
  chord: number;
  key: MusicKey;
  kick: boolean;
  light: boolean;
  level: number;
  open: number;
}

export function isSpeakerLayerId(id: string): id is SpeakerLayerId {
  return (SPEAKER_LAYER_IDS as readonly string[]).includes(id);
}

// The first beat that is still to be scheduled: a layer never starts between two beats.
export function entryTickOf(tick: number, cursor: number): number {
  return Math.ceil(Math.max(tick + 1, cursor) / TICKS_PER_BEAT) * TICKS_PER_BEAT;
}

// A speaker that is being plugged, or plugged but not yet in, is heard muffled and quiet; from its
// entry tick the filter opens over one bar. The break lightens it like the other layers.
export function presenceAt(step: number, entry: number | null, inBreak: boolean): Presence {
  const entered = entry !== null && step >= entry;
  const open = entered ? Math.min(1, (step - entry) / OPEN_TICKS) : 0;
  const level = entered ? 1 : MUFFLED_LEVEL;
  return {
    level: inBreak ? level * BREAK_LEVEL : level,
    open: inBreak ? open * BREAK_OPEN : open,
  };
}

function bright(open: number, hz: number, closed = MUFFLED_HZ): number {
  return closed * (Math.max(hz, closed) / closed) ** open;
}

const VOICE_DEGREES: readonly number[] = [4, 5, 4, 2];
const KNOCK_DEGREES: ReadonlyMap<number, number> = new Map([
  [1, 0],
  [7, 4],
  [11, 2],
  [15, 5],
]);
const ACID_DEGREES: readonly number[] = [0, 0, 7, 0, 3, 0, 7, 4, 0, 0, 7, 0, 4, 7, 9, 7];
const ACID_SLIDES: ReadonlySet<number> = new Set([3, 7, 13]);

function domeChill(ctx: VoiceContext) {
  const { out, at, bar, sixteenth, chord, key, level, open } = ctx;
  if (sixteenth % 8 === 0) {
    for (const offset of [0, 4]) {
      for (const detune of [-9, 9]) {
        playTone(out, at, {
          wave: 'triangle',
          hz: keyHz(key, chord + offset, 3),
          detune,
          gain: 0.045 * level,
          attack: BAR_SECONDS * 0.2,
          hold: BAR_SECONDS * 0.3,
          release: BAR_SECONDS * 0.4,
          pan: detune < 0 ? -0.5 : 0.5,
          filter: { type: 'lowpass', hz: bright(open, 1800, 420), q: 0.8 },
        });
      }
    }
  }
  if (!ctx.light && bar % 2 === 1 && sixteenth === 8) {
    const degree = VOICE_DEGREES[(bar >> 1) % VOICE_DEGREES.length] ?? 0;
    playTone(out, at, {
      wave: 'sine',
      hz: keyHz(key, chord + degree, 3),
      gain: 0.14 * level,
      attack: 0.3,
      hold: 0.7,
      release: 1.1,
      pan: 0.35,
      vibrato: { hz: 5, cents: 18, delay: 0.2 },
      filter: { type: 'lowpass', hz: bright(open, 2200, 520), q: 3 },
    });
  }
}

function foret(ctx: VoiceContext) {
  const { out, at, bar, sixteenth, key, level, open } = ctx;
  const degree = KNOCK_DEGREES.get(sixteenth);
  if (!ctx.light && degree !== undefined) {
    const hz = keyHz(key, degree, 4);
    const pan = (bar + sixteenth) % 2 === 0 ? -0.45 : 0.45;
    playTone(out, at, {
      wave: 'sine',
      hz,
      toHz: hz * 0.9,
      glide: 0.04,
      gain: 0.1 * level,
      attack: 0.001,
      hold: 0.004,
      release: 0.09,
      pan,
      filter: { type: 'lowpass', hz: bright(open, 3500, 650) },
    });
    playNoise(out, at, {
      gain: 0.07 * level,
      attack: 0.001,
      hold: 0.002,
      release: 0.025,
      pan,
      filter: { type: 'bandpass', hz: bright(open, 2200, 900), q: 4 },
    });
  }
  const birds = bar % 2 === 0 ? sixteenth === 5 : sixteenth === 13;
  if (birds) {
    const pan = bar % 4 < 2 ? 0.55 : -0.55;
    const count = bar % 2 === 0 ? 3 : 2;
    for (let index = 0; index < count; index += 1) {
      playTone(out, at + index * 0.065, {
        wave: 'sine',
        hz: 3000 + 250 * index,
        toHz: 4700 + 200 * index,
        glide: 0.045,
        gain: 0.03 * level,
        attack: 0.004,
        hold: 0.02,
        release: 0.04,
        pan,
        filter: { type: 'lowpass', hz: bright(open, 6500, 1200) },
      });
    }
  }
}

function sub(ctx: VoiceContext) {
  const { out, at, sixteenth, chord, key, level, open } = ctx;
  if (!ctx.kick || sixteenth % 4 !== 0) {
    return;
  }
  const hz = keyHz(key, chord, 0);
  playTone(out, at, {
    wave: 'sine',
    hz,
    gain: 0.5 * level,
    attack: 0.004,
    hold: 0.16,
    release: 0.2,
  });
  playTone(out, at, {
    wave: 'triangle',
    hz: hz * 2,
    gain: 0.12 * level,
    attack: 0.004,
    hold: 0.08,
    release: 0.12,
    filter: { type: 'lowpass', hz: bright(open, 320, 120) },
  });
}

function cercleAcid(ctx: VoiceContext) {
  const { out, at, bar, sixteenth, chord, key, level, open, light } = ctx;
  if (light && sixteenth % 4 !== 2) {
    return;
  }
  const degree = ACID_DEGREES[sixteenth] ?? 0;
  const accent = sixteenth % 4 === 2;
  const sweep = 0.5 - 0.5 * Math.cos((Math.PI * (bar * 16 + sixteenth)) / 64);
  const cutoff = bright(open, (accent ? 900 : 600) + 2400 * sweep, 320);
  const slide = ACID_SLIDES.has(sixteenth);
  playTone(out, at, {
    wave: 'sawtooth',
    hz: keyHz(key, chord + degree, 1),
    ...(slide
      ? {
          toHz: keyHz(key, chord + (ACID_DEGREES[(sixteenth + 1) % 16] ?? 0), 1),
          glide: SIXTEENTH * 0.9,
        }
      : {}),
    gain: (accent ? 0.075 : 0.05) * level,
    attack: 0.002,
    hold: SIXTEENTH * 0.55,
    release: SIXTEENTH * 0.3,
    pan: sixteenth % 2 === 0 ? -0.15 : 0.15,
    filter: { type: 'lowpass', hz: cutoff, toHz: cutoff * 0.3, glide: SIXTEENTH * 0.8, q: 13 },
  });
}

export const SPEAKER_VOICES: Readonly<Record<SpeakerLayerId, (ctx: VoiceContext) => void>> = {
  'dome-chill': domeChill,
  foret,
  sub,
  'cercle-acid': cercleAcid,
};

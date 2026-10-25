import type { SpeakerDefinition } from '../data/types';
import { isOneOf } from '../shared/guards';
import { MAIN_TEMPO, type Tempo } from '../shared/tempo';
import type { SpeakerState } from '../sim/state';
import { barSeconds, sixteenthSeconds } from './clock';
import { keyHz, type MusicKey } from './scale';
import { playNoise, playTone } from './synth';

export const SPEAKER_LAYER_IDS = ['dome-chill', 'foret', 'sub', 'cercle-acid'] as const;
export type SpeakerLayerId = (typeof SPEAKER_LAYER_IDS)[number];

const MUFFLED_HZ = 260;
// While a speaker charges, its layer comes to the front of the mix, up to four times its level
// (+12 dB) and fully open, then joins the mix at its own level once plugged.
const CHARGING_LEVEL = { from: 0.4, to: 4 };
const BREAK_LEVEL = 0.5;
const BREAK_OPEN = 0.6;

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
  tempo: Tempo;
}

export function isSpeakerLayerId(id: string): id is SpeakerLayerId {
  return isOneOf(id, SPEAKER_LAYER_IDS);
}

// A layer never starts between two beats.
export function entryTickOf(tick: number, cursor: number, tempo: Tempo = MAIN_TEMPO): number {
  const { ticksPerBeat: beat, originTick } = tempo;
  return originTick + Math.ceil((Math.max(tick + 1, cursor) - originTick) / beat) * beat;
}

export function speakerEntries(
  entered: ReadonlyMap<SpeakerLayerId, number>,
  speakers: readonly SpeakerState[],
  tick: number,
  cursor: number,
  tempo: Tempo,
): Map<SpeakerLayerId, number> {
  const entries = new Map<SpeakerLayerId, number>();
  for (const { id, plugged } of speakers) {
    if (plugged && isSpeakerLayerId(id) && !entries.has(id)) {
      entries.set(id, entered.get(id) ?? entryTickOf(tick, cursor, tempo));
    }
  }
  return entries;
}

// The share of its charge each speaker being plugged has, from 0 to 1.
export function pluggingSpeakers(
  speakers: readonly SpeakerState[],
  definitions: readonly Pick<SpeakerDefinition, 'id' | 'plugBars'>[],
  ticksPerBar: number,
): Map<SpeakerLayerId, number> {
  const charges = new Map<SpeakerLayerId, number>();
  for (const { id, plugged, plugTicks } of speakers) {
    const plugBars = definitions.find((definition) => definition.id === id)?.plugBars;
    if (!plugged && plugTicks > 0 && plugBars !== undefined && isSpeakerLayerId(id)) {
      charges.set(id, Math.min(1, plugTicks / (plugBars * ticksPerBar)));
    }
  }
  return charges;
}

export function presenceAt(
  step: number,
  entry: number | null,
  charge: number,
  inBreak: boolean,
): Presence {
  const entered = entry !== null && step >= entry;
  const { from, to } = CHARGING_LEVEL;
  const level = entered ? 1 : from + (to - from) * charge;
  const open = entered ? 1 : charge;
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
  const barLength = barSeconds(ctx.tempo);
  if (sixteenth % 8 === 0) {
    for (const offset of [0, 4]) {
      for (const detune of [-9, 9]) {
        playTone(out, at, {
          wave: 'triangle',
          hz: keyHz(key, chord + offset, 3),
          detune,
          gain: 0.026 * level,
          attack: barLength * 0.2,
          hold: barLength * 0.3,
          release: barLength * 0.4,
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
      gain: 0.08 * level,
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
    gain: 0.42 * level,
    attack: 0.004,
    hold: 0.16,
    release: 0.2,
  });
  playTone(out, at, {
    wave: 'triangle',
    hz: hz * 2,
    gain: 0.1 * level,
    attack: 0.004,
    hold: 0.08,
    release: 0.12,
    filter: { type: 'lowpass', hz: bright(open, 320, 120) },
  });
  // The growl two octaves up is what a laptop plays of the Sub.
  playTone(out, at, {
    wave: 'sawtooth',
    hz: hz * 4,
    gain: 0.175 * level,
    attack: 0.004,
    hold: 0.07,
    release: 0.12,
    filter: { type: 'lowpass', hz: bright(open, 1400, 200), q: 2 },
  });
}

function cercleAcid(ctx: VoiceContext) {
  const { out, at, bar, sixteenth, chord, key, level, open, light } = ctx;
  const step = sixteenthSeconds(ctx.tempo);
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
          glide: step * 0.9,
        }
      : {}),
    gain: (accent ? 0.075 : 0.05) * level,
    attack: 0.002,
    hold: step * 0.55,
    release: step * 0.3,
    pan: sixteenth % 2 === 0 ? -0.15 : 0.15,
    filter: { type: 'lowpass', hz: cutoff, toHz: cutoff * 0.3, glide: step * 0.8, q: 13 },
  });
}

export const SPEAKER_VOICES: Readonly<Record<SpeakerLayerId, (ctx: VoiceContext) => void>> = {
  'dome-chill': domeChill,
  foret,
  sub,
  'cercle-acid': cercleAcid,
};

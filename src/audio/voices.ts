import type { MusicVoiceId } from '../data/types';
import { TICKS_PER_BAR } from '../shared/tempo';
import { STEP_TICKS, TICK_SECONDS } from './clock';
import { playNoise, playTone } from './synth';

export interface MusicVoiceContext {
  out: AudioNode;
  // The same bus, through the echo.
  send: AudioNode;
  at: number;
  step: number;
  position: number;
  hz: number;
  // The part's previous note.
  fromHz: number;
  steps: number;
  cutoff: number;
  light: boolean;
  // Nothing may sound past it: the cut before a drop.
  until: number;
}

export type MusicVoice = (ctx: MusicVoiceContext) => void;

const SIXTEENTH = STEP_TICKS * TICK_SECONDS;
const BASS_ACCENTS = [0.8, 1, 1.3];
const ORIENTAL_VOICES: readonly (readonly [detune: number, octaves: number, gain: number])[] = [
  [-14, 0, 0.04],
  [0, 0, 0.04],
  [14, 0, 0.04],
  [0, 1, 0.018],
];

function texturePan(position: number): number {
  return position % 2 === 0 ? -0.6 : 0.6;
}

export const MUSIC_VOICES: Readonly<Record<MusicVoiceId, MusicVoice>> = {
  'rolling-bass': ({ out, at, hz, position, cutoff }) => {
    const accented = cutoff * (BASS_ACCENTS[position - 1] ?? 1);
    const envelope = { attack: 0.002, hold: SIXTEENTH * 0.5, release: SIXTEENTH * 0.25 };
    playTone(out, at, {
      ...envelope,
      wave: 'sawtooth',
      hz,
      gain: 0.42,
      filter: { type: 'lowpass', hz: accented, toHz: 140, glide: SIXTEENTH * 0.55, q: 6 },
    });
    playTone(out, at, {
      ...envelope,
      wave: 'square',
      hz: hz * 2,
      gain: 0.06,
      filter: { type: 'lowpass', hz: accented * 1.4, toHz: 220, glide: SIXTEENTH * 0.45, q: 3 },
    });
  },
  knock: ({ out, at, hz, position }) => {
    const pan = texturePan(position) * 0.6;
    playTone(out, at, {
      wave: 'triangle',
      hz,
      toHz: hz * 0.85,
      glide: 0.03,
      gain: 0.06,
      attack: 0.001,
      hold: 0.003,
      release: 0.05,
      pan,
    });
    playNoise(out, at, {
      gain: 0.12,
      attack: 0.001,
      hold: 0.002,
      release: 0.02,
      pan,
      filter: { type: 'bandpass', hz: 1800, q: 8 },
    });
  },
  chirp: ({ out, at, position }) => {
    for (const offset of [0, 0.07]) {
      playTone(out, at + offset, {
        wave: 'sine',
        hz: 2600,
        toHz: 4400,
        glide: 0.04,
        gain: 0.02,
        attack: 0.004,
        hold: 0.02,
        release: 0.03,
        pan: texturePan(position),
      });
    }
  },
  zap: ({ out, at, position }) => {
    playTone(out, at, {
      wave: 'sine',
      hz: 2800,
      toHz: 180,
      glide: 0.07,
      gain: 0.04,
      attack: 0.001,
      hold: 0.03,
      release: 0.05,
      pan: -texturePan(position),
    });
  },
  crickets: ({ out, at, position }) => {
    for (let pulse = 0; pulse < 4; pulse += 1) {
      playNoise(out, at + pulse * 0.035, {
        gain: 0.15,
        attack: 0.002,
        hold: 0.008,
        release: 0.012,
        pan: -texturePan(position),
        filter: { type: 'bandpass', hz: 4800, q: 12 },
      });
    }
  },
  arp: ({ out, at, hz, position }) => {
    playTone(out, at, {
      wave: 'square',
      hz,
      gain: 0.045,
      attack: 0.003,
      hold: 0.03,
      release: 0.06,
      pan: position % 2 === 0 ? -0.3 : 0.3,
      filter: { type: 'lowpass', hz: 2500, q: 2 },
    });
  },
  squelch: ({ out, at, hz, step }) => {
    const sweep = 0.5 - 0.5 * Math.cos((2 * Math.PI * step) / (8 * TICKS_PER_BAR));
    const cutoff = 500 + 2200 * sweep;
    playTone(out, at, {
      wave: 'sawtooth',
      hz,
      gain: 0.05,
      attack: 0.002,
      hold: SIXTEENTH * 0.6,
      release: SIXTEENTH * 0.3,
      filter: { type: 'lowpass', hz: cutoff, toHz: cutoff * 0.35, glide: SIXTEENTH * 0.8, q: 14 },
    });
  },
  lead: ({ out, at, hz, steps, cutoff, until }) => {
    for (const detune of [-8, 8]) {
      playTone(out, at, {
        wave: 'sawtooth',
        hz,
        detune,
        gain: 0.04,
        attack: 0.01,
        hold: Math.max(0, Math.min(steps * SIXTEENTH * 0.8, until - at - 0.08)),
        release: 0.08,
        filter: { type: 'lowpass', hz: cutoff, toHz: cutoff * 0.4, glide: steps * SIXTEENTH, q: 7 },
      });
    }
  },
  oriental: ({ send, at, hz, fromHz, steps, cutoff, light, until }) => {
    const long = steps >= 4;
    const release = long ? 0.16 : 0.07;
    const hold = Math.max(0, Math.min(steps * SIXTEENTH * 0.85, until - at - release));
    const level = light ? 0.45 : 1;
    for (const [detune, octaves, gain] of ORIENTAL_VOICES) {
      playTone(send, at, {
        wave: 'sawtooth',
        hz: fromHz * 2 ** octaves,
        toHz: hz * 2 ** octaves,
        glide: 0.04,
        detune,
        gain: gain * level,
        attack: 0.008,
        hold,
        release,
        ...(long ? { vibrato: { hz: 5.5, cents: 22, delay: 0.14 } } : {}),
        filter: {
          type: 'lowpass',
          hz: cutoff,
          toHz: cutoff * 0.55,
          glide: steps * SIXTEENTH,
          q: 3,
        },
      });
    }
  },
};

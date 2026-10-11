import type { MusicVoiceId } from '../data/types';
import { type Tempo } from '../shared/tempo';
import { sixteenthSeconds } from './clock';
import { playNoise, playTone } from './synth';

export interface MusicVoiceContext {
  out: AudioNode;
  // The same bus, through the echo.
  send: AudioNode;
  // The echo alone, for a voice that sends only part of itself into it.
  echo: AudioNode;
  at: number;
  step: number;
  tempo: Tempo;
  position: number;
  hz: number;
  // The part's previous note.
  fromHz: number;
  steps: number;
  cutoff: number;
  light: boolean;
  // Nothing may sound past it: the cut before a drop.
  until: number;
  accent: boolean;
  // Glides from the previous note.
  slide: boolean;
  // The next note slides from this one.
  legato: boolean;
  // The part's level.
  gain: number;
}

export type MusicVoice = (ctx: MusicVoiceContext) => void;

const SWEEP_BARS = 8;
const BASS_ACCENTS = [0.8, 1, 1.3];
const ORIENTAL_VOICES: readonly (readonly [detune: number, octaves: number, gain: number])[] = [
  [-14, 0, 0.04],
  [0, 0, 0.04],
  [14, 0, 0.04],
  [0, 1, 0.018],
];

const LAKE_PLUCK_VOICES: readonly (readonly [
  wave: OscillatorType,
  detune: number,
  gain: number,
])[] = [
  ['triangle', -6, 0.06],
  ['square', 6, 0.03],
];
const BOWL_PARTIALS: readonly (readonly [
  ratio: number,
  gain: number,
  release: number,
  pan: number,
])[] = [
  [1, 0.045, 5, -0.2],
  [1.004, 0.035, 5, 0.2],
  [2.76, 0.02, 3, -0.35],
  [5.4, 0.008, 1.6, 0.35],
];
// The vowel "aah": [formant hz, q, gain].
const CHOIR_FORMANTS: readonly (readonly [hz: number, q: number, gain: number])[] = [
  [780, 5, 1],
  [1180, 7, 0.55],
  [2500, 9, 0.15],
];
const TOM_HZ = [190, 160, 130, 105];
const GATE_TOP_HZ = 2200;

function sweepOf(step: number, tempo: Tempo): number {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * step) / (SWEEP_BARS * tempo.ticksPerBar));
}

function echoed(ctx: MusicVoiceContext, level: number): AudioNode {
  const context = ctx.out.context;
  const split = context.createGain();
  const toEcho = context.createGain();
  toEcho.gain.value = level;
  split.connect(ctx.out);
  split.connect(toEcho);
  toEcho.connect(ctx.echo);
  return split;
}

function held(ctx: MusicVoiceContext, steps: number, release: number, share = 0.85): number {
  return Math.max(
    0,
    Math.min(steps * sixteenthSeconds(ctx.tempo) * share, ctx.until - ctx.at - release),
  );
}

function texturePan(position: number): number {
  return position % 2 === 0 ? -0.6 : 0.6;
}

export const MUSIC_VOICES: Readonly<Record<MusicVoiceId, MusicVoice>> = {
  'rolling-bass': ({ out, at, hz, position, cutoff, tempo }) => {
    const sixteenth = sixteenthSeconds(tempo);
    const accented = cutoff * (BASS_ACCENTS[position - 1] ?? 1);
    const envelope = { attack: 0.002, hold: sixteenth * 0.5, release: sixteenth * 0.25 };
    playTone(out, at, {
      ...envelope,
      wave: 'sawtooth',
      hz,
      gain: 0.42,
      filter: { type: 'lowpass', hz: accented, toHz: 140, glide: sixteenth * 0.55, q: 6 },
    });
    playTone(out, at, {
      ...envelope,
      wave: 'square',
      hz: hz * 2,
      gain: 0.06,
      filter: { type: 'lowpass', hz: accented * 1.4, toHz: 220, glide: sixteenth * 0.45, q: 3 },
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
  squelch: ({ out, at, hz, step, tempo }) => {
    const sixteenth = sixteenthSeconds(tempo);
    const sweep = sweepOf(step, tempo);
    const cutoff = 500 + 2200 * sweep;
    playTone(out, at, {
      wave: 'sawtooth',
      hz,
      gain: 0.05,
      attack: 0.002,
      hold: sixteenth * 0.6,
      release: sixteenth * 0.3,
      filter: { type: 'lowpass', hz: cutoff, toHz: cutoff * 0.35, glide: sixteenth * 0.8, q: 14 },
    });
  },
  lead: ({ out, at, hz, steps, cutoff, until, tempo }) => {
    const sixteenth = sixteenthSeconds(tempo);
    for (const detune of [-8, 8]) {
      playTone(out, at, {
        wave: 'sawtooth',
        hz,
        detune,
        gain: 0.04,
        attack: 0.01,
        hold: Math.max(0, Math.min(steps * sixteenth * 0.8, until - at - 0.08)),
        release: 0.08,
        filter: { type: 'lowpass', hz: cutoff, toHz: cutoff * 0.4, glide: steps * sixteenth, q: 7 },
      });
    }
  },
  oriental: ({ send, at, hz, fromHz, steps, cutoff, light, until, tempo }) => {
    const sixteenth = sixteenthSeconds(tempo);
    const long = steps >= 4;
    const release = long ? 0.16 : 0.07;
    const hold = Math.max(0, Math.min(steps * sixteenth * 0.85, until - at - release));
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
          glide: steps * sixteenth,
          q: 3,
        },
      });
    }
  },
  'round-bass': ({ out, at, hz, cutoff, tempo }) => {
    const sixteenth = sixteenthSeconds(tempo);
    const envelope = { attack: 0.004, hold: sixteenth * 1.3, release: sixteenth * 0.5 };
    playTone(out, at, {
      ...envelope,
      wave: 'sawtooth',
      hz,
      gain: 0.34,
      filter: { type: 'lowpass', hz: cutoff, toHz: 160, glide: sixteenth * 1.6, q: 4 },
    });
    playTone(out, at, { ...envelope, wave: 'sine', hz, gain: 0.2 });
  },
  'ghost-bass': ({ out, at, hz, cutoff, tempo }) => {
    const sixteenth = sixteenthSeconds(tempo);
    playTone(out, at, {
      wave: 'sawtooth',
      hz,
      gain: 0.12,
      attack: 0.002,
      hold: sixteenth * 0.3,
      release: sixteenth * 0.2,
      filter: { type: 'lowpass', hz: cutoff * 0.8, q: 3 },
    });
  },
  'lake-pluck': ({ send, at, hz, position, cutoff, light }) => {
    // Every other note of the 3-3-2 rhythm, from the left.
    const pan = Math.floor((2 * position) / 5) % 2 === 0 ? -0.35 : 0.35;
    const open = Math.max(cutoff, light ? 1800 : 1500);
    for (const [wave, detune, gain] of LAKE_PLUCK_VOICES) {
      playTone(send, at, {
        wave,
        hz,
        detune,
        gain,
        attack: 0.002,
        hold: 0.02,
        release: 0.22,
        pan,
        filter: { type: 'lowpass', hz: open, toHz: 380, glide: 0.18, q: 4 },
      });
    }
  },
  'mist-lead': ({ send, at, hz, steps, tempo }) => {
    const sixteenth = sixteenthSeconds(tempo);
    const long = steps >= 4;
    for (const detune of [-8, 8]) {
      playTone(send, at, {
        wave: 'sawtooth',
        hz,
        detune,
        gain: 0.026,
        attack: 0.01,
        hold: steps * sixteenth * 0.82,
        release: long ? 0.16 : 0.08,
        ...(long ? { vibrato: { hz: 5.5, cents: 18, delay: 0.14 } } : {}),
        filter: { type: 'lowpass', hz: 2600, toHz: 1170, glide: steps * sixteenth, q: 5 },
      });
    }
  },
  droplet: ({ send, at, hz, position }) => {
    playTone(send, at, {
      wave: 'sine',
      hz: hz * 1.5,
      toHz: hz,
      glide: 0.02,
      gain: 0.05,
      attack: 0.002,
      hold: 0.01,
      release: 0.45,
      pan: Math.floor(position / 8) % 2 === 0 ? -0.6 : 0.6,
    });
  },
  'goa-lead': ({ send, at, hz, steps, cutoff, until, tempo }) => {
    const sixteenth = sixteenthSeconds(tempo);
    const long = steps >= 4;
    const release = long ? 0.16 : 0.08;
    for (const detune of [-12, 0, 12]) {
      playTone(send, at, {
        wave: 'sawtooth',
        hz,
        detune,
        gain: 0.027,
        attack: 0.01,
        hold: Math.max(0, Math.min(steps * sixteenth * 0.82, until - at - release)),
        release,
        ...(long ? { vibrato: { hz: 5.5, cents: 18, delay: 0.14 } } : {}),
        filter: {
          type: 'lowpass',
          hz: cutoff,
          toHz: cutoff * 0.45,
          glide: steps * sixteenth,
          q: 5,
        },
      });
    }
  },
  gate: ({ out, at, hz, cutoff, tempo }) => {
    const sixteenth = sixteenthSeconds(tempo);
    playTone(out, at, {
      wave: 'sawtooth',
      hz,
      gain: 0.018,
      attack: 0.002,
      hold: sixteenth * 0.5,
      release: sixteenth * 0.25,
      filter: { type: 'lowpass', hz: Math.min(cutoff, GATE_TOP_HZ), q: 2 },
    });
  },
  'goa-arp': ({ out, at, hz, position }) => {
    playTone(out, at, {
      wave: 'square',
      hz,
      gain: 0.022,
      attack: 0.003,
      hold: 0.025,
      release: 0.05,
      pan: position % 2 === 0 ? -0.4 : 0.4,
      filter: { type: 'lowpass', hz: 3000, q: 2 },
    });
  },
  tom: ({ out, at, position }) => {
    const hz = TOM_HZ[position % TOM_HZ.length] ?? 0;
    playTone(out, at, {
      wave: 'triangle',
      hz,
      toHz: hz * 0.55,
      glide: 0.18,
      gain: 0.32,
      attack: 0.001,
      hold: 0.03,
      release: 0.18,
    });
  },
  acid: ({ out, send, at, step, hz, fromHz, cutoff, light, accent, slide, legato, tempo }) => {
    const sixteenth = sixteenthSeconds(tempo);
    // 380-1300 Hz in a first buildup, 700-3800 Hz in a first drop, brighter with each tier.
    const [low, high] = light ? [300, 2200] : [250 + cutoff * 0.14, 320 + cutoff * 1.09];
    const open = low + (high - low) * sweepOf(step, tempo);
    playTone(light ? send : out, at, {
      wave: 'sawtooth',
      hz: slide ? fromHz : hz,
      toHz: hz,
      glide: 0.06,
      gain: (accent ? 0.085 : 0.06) * (light ? 0.55 : 1),
      attack: 0.002,
      hold: legato ? sixteenth : sixteenth * 0.55,
      release: sixteenth * 0.3,
      filter: {
        type: 'lowpass',
        hz: open * (accent ? 2.2 : 1.3),
        toHz: open * 0.4,
        glide: sixteenth * 0.9,
        q: 17,
      },
    });
  },
  croak: ({ out, at, position }) => {
    for (let pulse = 0; pulse < 3; pulse += 1) {
      playTone(out, at + pulse * 0.045, {
        wave: 'square',
        hz: 230 - pulse * 14,
        toHz: 170,
        glide: 0.035,
        gain: 0.07,
        attack: 0.002,
        hold: 0.012,
        release: 0.03,
        pan: position < 32 ? -0.55 : 0.55,
        filter: { type: 'bandpass', hz: 720, q: 7 },
      });
    }
  },
  laser: ({ send, at, position }) => {
    playTone(send, at, {
      wave: 'sine',
      hz: 2800,
      toHz: 180,
      glide: 0.08,
      gain: 0.04,
      attack: 0.001,
      hold: 0.03,
      release: 0.05,
      pan: position < 12 ? -0.5 : 0.5,
    });
  },
  kalimba: ({ send, at, hz, position }) => {
    const pan = position % 2 === 0 ? -0.4 : 0.4;
    playTone(send, at, {
      wave: 'sine',
      hz,
      gain: 0.065,
      attack: 0.002,
      hold: 0.01,
      release: 0.75,
      pan,
    });
    playTone(send, at, {
      wave: 'sine',
      hz: hz * 5.9,
      gain: 0.012,
      attack: 0.001,
      hold: 0.002,
      release: 0.08,
      pan,
    });
  },
  choir: ({ send, at, hz, steps, until, tempo }) => {
    const sixteenth = sixteenthSeconds(tempo);
    const release = 0.8;
    const hold = Math.max(0, Math.min(steps * sixteenth, until - at - 0.5 - release));
    for (const detune of [-9, 0, 9]) {
      for (const [formant, q, gain] of CHOIR_FORMANTS) {
        playTone(send, at, {
          wave: 'sawtooth',
          hz,
          detune,
          gain: 0.03 * gain,
          attack: 0.5,
          hold,
          release,
          ...(steps >= 4 ? { vibrato: { hz: 5, cents: 14, delay: 0.3 } } : {}),
          filter: { type: 'bandpass', hz: formant, q },
        });
      }
    }
  },
  siren: ({ send, at, hz, steps, until, tempo }) => {
    const sixteenth = sixteenthSeconds(tempo);
    const seconds = Math.max(0.5, Math.min(steps * sixteenth, until - at));
    playTone(send, at, {
      wave: 'sine',
      hz,
      toHz: hz * 1.8,
      glide: seconds,
      gain: 0.045,
      attack: 0.15,
      hold: seconds * 0.7,
      release: seconds * 0.3,
      pan: -0.2,
      fm: { wave: 'sawtooth', hz: 2.2, toHz: 5, glide: seconds, depth: hz * 0.35 },
    });
  },
  bowl: ({ send, at, hz, gain: level }) => {
    for (const [ratio, gain, release, pan] of BOWL_PARTIALS) {
      playTone(send, at, {
        wave: 'sine',
        hz: hz * ratio,
        gain: gain * level,
        attack: 0.008,
        hold: 0.05,
        release,
        pan,
      });
    }
  },
  // An accented step is the doum, the others the tek.
  darbouka: ({ out, at, position, accent, light }) => {
    const level = light ? 0.5 : 1;
    if (accent) {
      playTone(out, at, {
        wave: 'sine',
        hz: 105,
        toHz: 63,
        glide: 0.25,
        gain: 0.42 * level,
        attack: 0.001,
        hold: 0.02,
        release: 0.32,
      });
      playNoise(out, at, {
        gain: 0.105 * level,
        attack: 0.001,
        hold: 0.004,
        release: 0.07,
        filter: { type: 'lowpass', hz: 380 },
      });
      return;
    }
    const pan = position % 2 === 0 ? 0.2 : -0.2;
    playNoise(out, at, {
      gain: 0.13 * level,
      attack: 0.001,
      hold: 0.002,
      release: 0.045,
      pan,
      filter: { type: 'bandpass', hz: 3600, q: 1.6 },
    });
    playTone(out, at, {
      wave: 'triangle',
      hz: 1150,
      toHz: 900,
      glide: 0.02,
      gain: 0.04 * level,
      attack: 0.001,
      hold: 0.002,
      release: 0.03,
      pan,
    });
  },
  riq: ({ out, at, position }) => {
    const pan = position % 8 < 4 ? -0.3 : 0.3;
    for (const offset of [0, 0.011, 0.024]) {
      playNoise(out, at + offset, {
        gain: 0.05,
        attack: 0.001,
        hold: 0.002,
        release: 0.08,
        pan,
        filter: { type: 'highpass', hz: 8200 },
      });
    }
  },
  oud: ({ out, send, at, hz, position, light }) => {
    const level = light ? 0.75 : 1;
    const pan = position % 2 === 0 ? -0.3 : 0.3;
    playTone(send, at, {
      wave: 'sawtooth',
      hz: hz * 1.015,
      toHz: hz,
      glide: 0.02,
      gain: 0.065 * level,
      attack: 0.002,
      hold: 0.01,
      release: 0.42,
      pan,
      filter: { type: 'lowpass', hz: 3600, toHz: 260, glide: 0.32, q: 2.5 },
    });
    playTone(out, at, {
      wave: 'triangle',
      hz: hz * 2,
      gain: 0.015 * level,
      attack: 0.001,
      hold: 0.004,
      release: 0.15,
      pan,
    });
  },
  ney: ({ out, send, at, hz, steps, until, light, tempo }) => {
    const sixteenth = sixteenthSeconds(tempo);
    const level = light ? 0.6 : 1;
    const hold = Math.max(0, Math.min(steps * sixteenth * 0.85, until - at - 0.22));
    const vibrato = steps >= 3 ? { hz: 5.4, cents: 24, delay: 0.16 } : undefined;
    playTone(send, at, {
      wave: 'triangle',
      hz: hz * 0.985,
      toHz: hz,
      glide: 0.06,
      gain: 0.05 * level,
      attack: 0.05,
      hold,
      release: 0.22,
      ...(vibrato ? { vibrato } : {}),
      filter: { type: 'lowpass', hz: 2400 },
    });
    playTone(out, at, {
      wave: 'sine',
      hz: hz * 2,
      gain: 0.01 * level,
      attack: 0.06,
      hold,
      release: 0.2,
      ...(vibrato ? { vibrato } : {}),
    });
    playNoise(out, at, {
      gain: 0.022 * level,
      attack: 0.04,
      hold: Math.max(0, Math.min(steps * sixteenth * 0.7, until - at - 0.18)),
      release: 0.18,
      filter: { type: 'bandpass', hz: hz * 2, q: 9 },
    });
  },
  sub: (ctx) => {
    const { out, at, hz, gain, steps } = ctx;
    playTone(out, at, {
      wave: 'sine',
      hz,
      gain: 0.38 * gain,
      attack: 0.006,
      hold: held(ctx, steps, 0.12),
      release: 0.12,
    });
  },
  'sub-saw': (ctx) => {
    const { out, at, hz, gain, steps, cutoff } = ctx;
    playTone(out, at, {
      wave: 'sawtooth',
      hz,
      gain: 0.12 * gain,
      attack: 0.006,
      hold: held(ctx, steps, 0.1),
      release: 0.1,
      filter: { type: 'lowpass', hz: cutoff, q: 2 },
    });
  },
  skank: (ctx) => {
    const { at, hz, position, gain, light } = ctx;
    playTone(echoed(ctx, light ? 0.85 : 0.5), at, {
      wave: 'square',
      hz,
      gain: 0.02 * gain,
      attack: 0.002,
      hold: 0.035,
      release: 0.07,
      pan: position < 8 ? -0.3 : 0.3,
      filter: { type: 'lowpass', hz: 1500, q: 1.5 },
    });
  },
  flute: (ctx) => {
    const { out, at, hz, steps, cutoff, light } = ctx;
    const level = light ? 0.85 : 1;
    const vibrato = steps >= 4 ? { hz: 5, cents: 16, delay: 0.2 } : undefined;
    playTone(echoed(ctx, 0.3), at, {
      wave: 'triangle',
      hz,
      gain: 0.05 * level,
      attack: 0.07,
      hold: held(ctx, steps, 0.25),
      release: 0.25,
      ...(vibrato ? { vibrato } : {}),
      filter: { type: 'lowpass', hz: cutoff },
    });
    playTone(out, at, {
      wave: 'sine',
      hz: hz * 2,
      gain: 0.012 * level,
      attack: 0.09,
      hold: held(ctx, steps, 0.2, 0.8),
      release: 0.2,
    });
  },
  melodica: (ctx) => {
    const { at, hz, steps } = ctx;
    const vibrato = steps >= 3 ? { hz: 5.8, cents: 14, delay: 0.15 } : undefined;
    const into = echoed(ctx, 0.4);
    for (const detune of [-6, 6]) {
      playTone(into, at, {
        wave: 'square',
        hz,
        detune,
        gain: 0.022,
        attack: 0.03,
        hold: held(ctx, steps, 0.1, 0.82),
        release: 0.1,
        ...(vibrato ? { vibrato } : {}),
        filter: { type: 'lowpass', hz: 1900, q: 1.2 },
      });
    }
  },
};

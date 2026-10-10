import type { DrumVoiceId } from '../data/types';
import { playNoise, playTone } from './synth';

export interface DrumContext {
  out: AudioNode;
  at: number;
  gain: number;
  pan: number | undefined;
  // The track's kick: it falls from `fromHz` to the key's root.
  kick: { fromHz: number; toHz: number; release: number };
}

export type DrumVoice = (ctx: DrumContext) => void;

const FRAME_DRUM_HZ = 72;
const DOUM_HZ = 105;

function tom(ctx: DrumContext, hz: number, gain: number, release: number) {
  const { out, at, pan } = ctx;
  playTone(out, at, {
    wave: 'sine',
    hz,
    toHz: hz * 0.6,
    glide: 0.25,
    gain,
    attack: 0.001,
    hold: 0.02,
    release,
    pan,
  });
  playNoise(out, at, {
    gain: gain * 0.25,
    attack: 0.001,
    hold: 0.004,
    release: 0.07,
    pan,
    filter: { type: 'lowpass', hz: 380 },
  });
}

export const DRUM_VOICES: Record<DrumVoiceId, DrumVoice> = {
  kick({ out, at, gain, pan, kick }) {
    playTone(out, at, {
      wave: 'sine',
      hz: kick.fromHz,
      toHz: kick.toHz,
      glide: 0.045,
      gain,
      attack: 0.0005,
      hold: 0.04,
      release: kick.release,
      pan,
    });
    playNoise(out, at, {
      gain: 0.14 * gain,
      attack: 0.0005,
      hold: 0.002,
      release: 0.01,
      pan,
      filter: { type: 'highpass', hz: 2500 },
    });
  },
  snare({ out, at, gain, pan }) {
    playNoise(out, at, {
      gain: 0.2 * gain,
      attack: 0.001,
      hold: 0.006,
      release: 0.2,
      pan,
      filter: { type: 'bandpass', hz: 1900, q: 0.7 },
    });
    playTone(out, at, {
      wave: 'triangle',
      hz: 215,
      toHz: 170,
      glide: 0.05,
      gain: 0.16 * gain,
      attack: 0.001,
      hold: 0.008,
      release: 0.09,
      pan,
    });
  },
  rim({ out, at, gain, pan }) {
    playTone(out, at, {
      wave: 'triangle',
      hz: 1750,
      gain: 0.07 * gain,
      attack: 0.001,
      hold: 0.003,
      release: 0.03,
      pan,
    });
    playNoise(out, at, {
      gain: 0.07 * gain,
      attack: 0.001,
      hold: 0.002,
      release: 0.02,
      pan,
      filter: { type: 'bandpass', hz: 2600, q: 3 },
    });
  },
  clap({ out, at, gain, pan }) {
    [0, 0.009, 0.018].forEach((offset, index) => {
      playNoise(out, at + offset, {
        gain: 0.14 * gain,
        attack: 0.001,
        hold: 0.002,
        release: index === 2 ? 0.14 : 0.012,
        pan,
        filter: { type: 'bandpass', hz: 1400, q: 1.3 },
      });
    });
  },
  hat({ out, at, gain, pan }) {
    playNoise(out, at, {
      gain: 0.11 * gain,
      attack: 0.001,
      hold: 0,
      release: 0.035,
      pan,
      filter: { type: 'highpass', hz: 7000 },
    });
  },
  shaker({ out, at, gain, pan }) {
    playNoise(out, at, {
      gain: 0.07 * gain,
      attack: 0.008,
      hold: 0.004,
      release: 0.04,
      pan,
      filter: { type: 'highpass', hz: 6500 },
    });
  },
  rattle({ out, at, gain, pan }) {
    playNoise(out, at, {
      gain: 0.06 * gain,
      attack: 0.012,
      hold: 0.015,
      release: 0.07,
      pan,
      filter: { type: 'bandpass', hz: 4800, q: 0.8 },
    });
  },
  doum(ctx) {
    tom(ctx, DOUM_HZ, 0.42 * ctx.gain, 0.32);
  },
  tek({ out, at, gain, pan }) {
    playNoise(out, at, {
      gain: 0.13 * gain,
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
      gain: 0.04 * gain,
      attack: 0.001,
      hold: 0.002,
      release: 0.03,
      pan,
    });
  },
  'frame-drum'(ctx) {
    tom(ctx, FRAME_DRUM_HZ, 0.55 * ctx.gain, 0.45);
  },
};

import type { MusicTrack } from '../data/types';
import { clamp01 } from '../shared/scalar';
import { SUNRISE_SEMITONES, keyHz, midiToHz, type MusicKey } from './scale';
import { playNoise, playTone } from './synth';

const SUNRISE_ATTACK = 4;
const SUNRISE_HOLD = 12;
export const EXTINCTION_SECONDS = 1.6;
const RISER_LOW_HZ = 300;
const RISER_HIGH_HZ = 7000;
const SOFT_RISER_HIGH_HZ = 1800;
const PULSE_GLIDE = 0.12;

export function kick(out: AudioNode, at: number, track: MusicTrack) {
  playTone(out, at, {
    wave: 'sine',
    hz: track.kick.fromHz,
    toHz: keyHz(track, 0, 0),
    glide: 0.045,
    gain: 1,
    attack: 0.0005,
    hold: 0.04,
    release: track.kick.release,
  });
  playNoise(out, at, {
    gain: 0.14,
    attack: 0.0005,
    hold: 0.002,
    release: 0.01,
    filter: { type: 'highpass', hz: 2500 },
  });
}

export function pulse(out: AudioNode, at: number, gain: number, track: MusicTrack) {
  const envelope = { attack: 0.003, hold: 0.03, release: 0.14 };
  playTone(out, at, {
    wave: 'sine',
    hz: keyHz(track, 0, 2),
    toHz: keyHz(track, 0, 0),
    glide: PULSE_GLIDE,
    gain,
    ...envelope,
  });
  playTone(out, at, {
    wave: 'triangle',
    hz: keyHz(track, 0, 2),
    gain: gain * 0.22,
    ...envelope,
    filter: { type: 'lowpass', hz: 700 },
  });
}

export function hat(out: AudioNode, at: number, open: boolean, pan: number) {
  playNoise(out, at, {
    gain: open ? 0.28 : 0.14,
    attack: 0.001,
    hold: 0,
    release: open ? 0.12 : 0.035,
    pan,
    filter: { type: 'highpass', hz: 7000 },
  });
}

export function clap(out: AudioNode, at: number) {
  [0, 0.009, 0.018].forEach((offset, index) => {
    playNoise(out, at + offset, {
      gain: 0.14,
      attack: 0.001,
      hold: 0.002,
      release: index === 2 ? 0.14 : 0.012,
      filter: { type: 'bandpass', hz: 1400, q: 1.3 },
    });
  });
}

export function crash(out: AudioNode, at: number, gain: number) {
  playNoise(out, at, {
    gain,
    attack: 0.002,
    hold: 0.02,
    release: 1.8,
    filter: { type: 'highpass', hz: 5500 },
  });
}

export function snare(out: AudioNode, at: number, progress: number, key: MusicKey) {
  playNoise(out, at, {
    gain: 0.04 + 0.1 * progress,
    attack: 0.001,
    hold: 0.004,
    release: 0.06,
    filter: { type: 'bandpass', hz: 1200 + 3000 * progress, q: 0.9 },
  });
  playTone(out, at, {
    wave: 'triangle',
    hz: keyHz(key, 3, 2),
    toHz: keyHz(key, 0, 2),
    glide: 0.04,
    gain: 0.03 + 0.06 * progress,
    attack: 0.001,
    hold: 0.005,
    release: 0.05,
  });
}

export function pad(
  out: AudioNode,
  at: number,
  chord: number,
  seconds: number,
  attack: number,
  release: number,
  key: MusicKey,
  cutoff: number,
) {
  for (const offset of [0, 2, 4]) {
    for (const detune of [-10, 10]) {
      playTone(out, at, {
        wave: 'sawtooth',
        hz: keyHz(key, chord + offset, 2),
        detune,
        gain: 0.025,
        attack: Math.min(attack, seconds),
        hold: Math.max(0, seconds - attack),
        release,
        pan: detune < 0 ? -0.4 : 0.4,
        filter: { type: 'lowpass', hz: cutoff },
      });
    }
  }
}

export function riser(
  out: AudioNode,
  from: number,
  until: number,
  progress: number,
  track: MusicTrack,
) {
  const seconds = until - from;
  const done = clamp01(progress);
  const soft = track.build === 'soft';
  const high = soft ? SOFT_RISER_HIGH_HZ : RISER_HIGH_HZ;
  playNoise(out, from, {
    gain: soft ? 0.05 : 0.15,
    attack: seconds,
    hold: 0,
    release: 0.03,
    filter: {
      type: 'bandpass',
      hz: RISER_LOW_HZ * (high / RISER_LOW_HZ) ** done,
      toHz: high,
      glide: seconds,
      q: 1.5,
    },
  });
  if (soft) {
    return;
  }
  playTone(out, from, {
    wave: 'sawtooth',
    hz: keyHz(track, 0, 2) * 4 ** done,
    toHz: keyHz(track, 0, 4),
    glide: seconds,
    gain: 0.03,
    attack: seconds,
    hold: 0,
    release: 0.03,
    filter: { type: 'lowpass', hz: 3000 },
  });
}

export function downlifter(out: AudioNode, at: number, soft: boolean) {
  playNoise(out, at, {
    gain: soft ? 0.07 : 0.2,
    attack: 0.005,
    hold: 0.1,
    release: 2.4,
    filter: { type: 'bandpass', hz: 6000, toHz: 300, glide: 2.4, q: 1.2 },
  });
  crash(out, at, soft ? 0.03 : 0.09);
}

export function impact(out: AudioNode, at: number) {
  playTone(out, at, {
    wave: 'sine',
    hz: 160,
    toHz: 32,
    glide: 0.7,
    gain: 0.95,
    attack: 0.002,
    hold: 0.12,
    release: 1.3,
  });
  playNoise(out, at, {
    gain: 0.22,
    attack: 0.002,
    hold: 0.04,
    release: 0.5,
    filter: { type: 'bandpass', hz: 900, q: 0.8 },
  });
  crash(out, at, 0.2);
}

export function sunrise(out: AudioNode, at: number, key: MusicKey): number {
  for (const semitones of SUNRISE_SEMITONES) {
    for (const detune of [-7, 7]) {
      playTone(out, at, {
        wave: 'triangle',
        hz: midiToHz(key.rootMidi + 24 + semitones),
        detune,
        gain: 0.035,
        attack: SUNRISE_ATTACK,
        hold: SUNRISE_HOLD,
        release: 10,
        filter: { type: 'lowpass', hz: 600, toHz: 2500, glide: 8 },
      });
    }
  }
  return at + SUNRISE_ATTACK + SUNRISE_HOLD;
}

export function powerDown(out: AudioNode, at: number, key: MusicKey): number {
  for (const degree of [0, 4]) {
    const hz = keyHz(key, degree, 2);
    playTone(out, at, {
      wave: 'sawtooth',
      hz,
      toHz: hz / 8,
      glide: EXTINCTION_SECONDS,
      gain: 0.1,
      attack: 0.005,
      hold: EXTINCTION_SECONDS * 0.7,
      release: EXTINCTION_SECONDS * 0.4,
      filter: { type: 'lowpass', hz: 3000, toHz: 80, glide: EXTINCTION_SECONDS },
    });
  }
  return at + EXTINCTION_SECONDS;
}

import { TICKS_PER_BAR, barOfTick, phraseOfTick } from '../shared/tempo';
import type { GameStatus, SetProgress, SetSegment, SimState } from '../sim/state';
import {
  LATE_TOLERANCE_SECONDS,
  LOOKAHEAD_SECONDS,
  STEP_TICKS,
  TICK_SECONDS,
  firstStepAtOrAfter,
  follow,
  stepsToSchedule,
  tickToTime,
  timeToTick,
  type Anchor,
} from './clock';
import { ROOT_MIDI, SUNRISE_SEMITONES, chordRootOfBar, degreeToHz, midiToHz } from './scale';
import { playNoise, playTone } from './synth';

export type MusicMode = 'playing' | 'won' | 'lost';

export interface Layers {
  kick: boolean;
  bass: boolean;
  hats: boolean;
  hats16: boolean;
  pad: boolean;
  arp: boolean;
  lead: boolean;
  leadCutoff: number;
}

export interface MusicOptions {
  breakBars: (tier: number) => number;
  onKickScheduled: ((tick: number, time: number) => void) | undefined;
}

export interface Music {
  update(state: SimState, now: number, currentTime: number): void;
}

interface Bus {
  input: BiquadFilterNode;
  output: GainNode;
}

const SIXTEENTH = STEP_TICKS * TICK_SECONDS;
const CUT_SECONDS = 0.02;
const WON_FADE_SECONDS = 1.5;
const EXTINCTION_SECONDS = 1.6;
const BUS_TAIL_SECONDS = 2;
const RISER_LOW_HZ = 300;
const RISER_HIGH_HZ = 7000;
const ARP_DEGREES = [0, 2, 4, 7, 9, 7, 4, 2];
const LEAD_NOTES: readonly (readonly [step: number, degree: number, steps: number])[] = [
  [0, 7, 2],
  [3, 8, 1],
  [4, 7, 2],
  [6, 4, 2],
  [10, 5, 2],
  [12, 4, 4],
  [16, 7, 2],
  [19, 8, 1],
  [20, 9, 2],
  [22, 8, 2],
  [26, 7, 2],
  [28, 11, 4],
];

export function modeOf(status: GameStatus): MusicMode {
  if (status === 'won' || status === 'lost') {
    return status;
  }
  return 'playing';
}

export function phraseAt(progress: SetProgress, fromTick: number, tick: number): number {
  return progress.phrase + phraseOfTick(tick) - phraseOfTick(fromTick);
}

export function dropTickOf(progress: SetProgress, breakBars: number): number | null {
  return progress.segment === 'break'
    ? progress.segmentStartTick + breakBars * TICKS_PER_BAR
    : null;
}

export function segmentAt(segment: SetSegment, dropTick: number | null, tick: number): SetSegment {
  return segment === 'break' && dropTick !== null && tick >= dropTick ? 'drop' : segment;
}

export function layersFor(segment: SetSegment, tier: number, phrase: number): Layers {
  switch (segment) {
    case 'buildup':
      return {
        kick: true,
        bass: true,
        hats: true,
        hats16: tier >= 1,
        pad: phrase >= 1,
        arp: phrase >= 2,
        lead: phrase >= 3 || tier >= 1,
        leadCutoff: 900 + 700 * tier,
      };
    case 'break':
      return {
        kick: false,
        bass: false,
        hats: false,
        hats16: false,
        pad: true,
        arp: true,
        lead: false,
        leadCutoff: 0,
      };
    case 'drop':
      return {
        kick: true,
        bass: true,
        hats: true,
        hats16: true,
        pad: true,
        arp: true,
        lead: true,
        leadCutoff: 3200 + 800 * tier,
      };
  }
}

function kick(out: AudioNode, at: number) {
  playTone(out, at, {
    wave: 'sine',
    hz: 190,
    toHz: degreeToHz(0, 0),
    glide: 0.07,
    gain: 0.95,
    attack: 0.001,
    hold: 0.03,
    release: 0.24,
  });
  playNoise(out, at, {
    gain: 0.12,
    attack: 0.0005,
    hold: 0.002,
    release: 0.012,
    filter: { type: 'highpass', hz: 3000 },
  });
}

function bass(out: AudioNode, at: number, chord: number) {
  playTone(out, at, {
    wave: 'sawtooth',
    hz: degreeToHz(chord, 0),
    gain: 0.4,
    attack: 0.002,
    hold: SIXTEENTH * 0.45,
    release: SIXTEENTH * 0.35,
    filter: { type: 'lowpass', hz: 900, toHz: 180, glide: SIXTEENTH * 0.6, q: 5 },
  });
}

function hat(out: AudioNode, at: number, open: boolean) {
  playNoise(out, at, {
    gain: open ? 0.1 : 0.05,
    attack: 0.001,
    hold: 0,
    release: open ? 0.09 : 0.03,
    filter: { type: 'highpass', hz: 7000 },
  });
}

function arp(out: AudioNode, at: number, chord: number, sixteenth: number) {
  playTone(out, at, {
    wave: 'square',
    hz: degreeToHz(chord + (ARP_DEGREES[sixteenth % ARP_DEGREES.length] ?? 0), 2),
    gain: 0.045,
    attack: 0.003,
    hold: 0.03,
    release: 0.06,
    filter: { type: 'lowpass', hz: 2500, q: 2 },
  });
}

function lead(out: AudioNode, at: number, position: number, cutoff: number) {
  const note = LEAD_NOTES.find(([step]) => step === position);
  if (note === undefined) {
    return;
  }
  const [, degree, steps] = note;
  for (const detune of [-8, 8]) {
    playTone(out, at, {
      wave: 'sawtooth',
      hz: degreeToHz(degree, 3),
      detune,
      gain: 0.04,
      attack: 0.01,
      hold: steps * SIXTEENTH * 0.8,
      release: 0.08,
      filter: { type: 'lowpass', hz: cutoff, toHz: cutoff * 0.4, glide: steps * SIXTEENTH, q: 7 },
    });
  }
}

function pad(out: AudioNode, at: number, chord: number, seconds: number, attack: number) {
  for (const offset of [0, 2, 4]) {
    for (const detune of [-10, 10]) {
      playTone(out, at, {
        wave: 'sawtooth',
        hz: degreeToHz(chord + offset, 2),
        detune,
        gain: 0.025,
        attack,
        hold: Math.max(0, seconds - attack),
        release: 0.6,
        filter: { type: 'lowpass', hz: 900 },
      });
    }
  }
}

function riser(out: AudioNode, from: number, until: number, progress: number) {
  const seconds = until - from;
  const done = Math.min(1, Math.max(0, progress));
  playNoise(out, from, {
    gain: 0.25,
    attack: seconds,
    hold: 0,
    release: 0.05,
    filter: {
      type: 'bandpass',
      hz: RISER_LOW_HZ * (RISER_HIGH_HZ / RISER_LOW_HZ) ** done,
      toHz: RISER_HIGH_HZ,
      glide: seconds,
      q: 1.5,
    },
  });
  playTone(out, from, {
    wave: 'sawtooth',
    hz: degreeToHz(0, 2) * 4 ** done,
    toHz: degreeToHz(0, 4),
    glide: seconds,
    gain: 0.04,
    attack: seconds,
    hold: 0,
    release: 0.05,
    filter: { type: 'lowpass', hz: 3000 },
  });
}

function impact(out: AudioNode, at: number) {
  playTone(out, at, {
    wave: 'sine',
    hz: 120,
    toHz: 30,
    glide: 0.8,
    gain: 0.9,
    attack: 0.002,
    hold: 0.1,
    release: 1.1,
  });
  playNoise(out, at, {
    gain: 0.3,
    attack: 0.002,
    hold: 0.05,
    release: 1.5,
    filter: { type: 'highpass', hz: 1200 },
  });
}

function sunrise(out: AudioNode, at: number) {
  for (const semitones of SUNRISE_SEMITONES) {
    for (const detune of [-7, 7]) {
      playTone(out, at, {
        wave: 'triangle',
        hz: midiToHz(ROOT_MIDI + 24 + semitones),
        detune,
        gain: 0.035,
        attack: 4,
        hold: 12,
        release: 10,
        filter: { type: 'lowpass', hz: 600, toHz: 2500, glide: 8 },
      });
    }
  }
}

function powerDown(out: AudioNode, at: number) {
  for (const degree of [0, 4]) {
    const hz = degreeToHz(degree, 2);
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
}

export function createMusic(out: AudioNode, options: MusicOptions): Music {
  const context = out.context;
  let bus: Bus | null = null;
  let anchor: Anchor | null = null;
  let cursor = 0;
  let mode: MusicMode | null = null;
  let segment: SetSegment | null = null;
  let tier = 0;
  let dropTick: number | null = null;
  let followedTick = -1;

  function openBus(): Bus {
    const input = context.createBiquadFilter();
    input.type = 'lowpass';
    input.frequency.value = 20_000;
    input.Q.value = 0.7;
    const output = context.createGain();
    input.connect(output);
    output.connect(out);
    bus = { input, output };
    return bus;
  }

  function retire(old: Bus | null, fadeSeconds: number) {
    if (old === null) {
      return;
    }
    old.output.gain.setTargetAtTime(0, context.currentTime, fadeSeconds / 4);
    setTimeout(
      () => {
        old.output.disconnect();
      },
      (fadeSeconds + LOOKAHEAD_SECONDS + BUS_TAIL_SECONDS) * 1000,
    );
  }

  function extinguish(at: number) {
    if (bus !== null) {
      bus.input.frequency.setValueAtTime(bus.input.frequency.value, at);
      bus.input.frequency.exponentialRampToValueAtTime(60, at + EXTINCTION_SECONDS);
    }
    retire(bus, EXTINCTION_SECONDS);
    powerDown(openBus().input, at);
  }

  function sustain(target: Bus, state: SimState, from: number, clock: Anchor) {
    const { set, tick } = state;
    const layers = layersFor(set.segment, set.tier, set.phrase);
    const bar = barOfTick(tick);
    const barEnd = tickToTime(clock, (bar + 1) * TICKS_PER_BAR);
    if (layers.pad && tick % TICKS_PER_BAR !== 0 && barEnd > from) {
      pad(target.input, from, chordRootOfBar(bar), barEnd - from, CUT_SECONDS);
    }
    if (dropTick !== null) {
      const start = tickToTime(clock, set.segmentStartTick);
      const end = tickToTime(clock, dropTick);
      if (end - from > SIXTEENTH) {
        riser(target.input, from, end, (from - start) / (end - start));
      }
    }
  }

  function playStep(
    target: Bus,
    step: number,
    state: SimState,
    clock: Anchor,
    currentTime: number,
  ) {
    const at = Math.max(tickToTime(clock, step), currentTime);
    const current = segmentAt(state.set.segment, dropTick, step);
    if (current !== state.set.segment && step === dropTick) {
      impact(target.input, at);
    }
    const layers = layersFor(current, tier, phraseAt(state.set, state.tick, step));
    const sixteenth = (step % TICKS_PER_BAR) / STEP_TICKS;
    const inBeat = sixteenth % 4;
    const bar = barOfTick(step);
    const chord = chordRootOfBar(bar);
    const input = target.input;
    if (inBeat === 0 && layers.kick) {
      kick(input, at);
      options.onKickScheduled?.(step, at);
    }
    if (inBeat !== 0 && layers.bass) {
      bass(input, at, chord);
    }
    if (layers.hats && inBeat === 2) {
      hat(input, at, true);
    } else if (layers.hats16 && inBeat !== 0) {
      hat(input, at, false);
    }
    if (layers.arp) {
      arp(input, at, chord, sixteenth);
    }
    if (layers.lead) {
      lead(input, at, sixteenth + 16 * (bar % 2), layers.leadCutoff);
    }
    if (layers.pad && sixteenth === 0) {
      pad(input, at, chord, TICKS_PER_BAR * TICK_SECONDS, 0.3);
    }
  }

  return {
    update(state, now, currentTime) {
      const nextMode = modeOf(state.status);
      if (nextMode !== mode) {
        mode = nextMode;
        anchor = null;
        segment = null;
        if (nextMode === 'won') {
          retire(bus, WON_FADE_SECONDS);
          sunrise(openBus().input, currentTime);
        } else if (nextMode === 'lost') {
          extinguish(currentTime);
        }
      }
      if (mode !== 'playing') {
        return;
      }

      const followed =
        anchor !== null && state.tick === followedTick
          ? { anchor, resynced: false }
          : follow(anchor, state.tick, now);
      const clock = followed.anchor;
      anchor = clock;
      followedTick = state.tick;
      const { set } = state;
      const previous = segment;
      const foreseen =
        previous === 'break' && set.segment === 'drop' && set.segmentStartTick === dropTick;
      const entered = !foreseen && (set.segment !== previous || set.tier !== tier);
      segment = set.segment;
      tier = set.tier;
      dropTick = dropTickOf(set, set.segment === 'break' ? options.breakBars(set.tier) : 0);
      let target = bus;
      if (target === null || followed.resynced || entered) {
        retire(bus, CUT_SECONDS);
        target = openBus();
        cursor = firstStepAtOrAfter(
          followed.resynced ? state.tick : Math.max(state.tick, timeToTick(clock, currentTime)),
        );
        if (entered && previous !== null && set.segment === 'drop') {
          impact(target.input, Math.max(tickToTime(clock, state.tick), currentTime));
        }
        sustain(target, state, currentTime, clock);
      }

      const range = stepsToSchedule(
        clock,
        cursor,
        currentTime - LATE_TOLERANCE_SECONDS,
        currentTime + LOOKAHEAD_SECONDS,
      );
      for (let step = range.from; step < range.until; step += STEP_TICKS) {
        playStep(target, step, state, clock, currentTime);
      }
      cursor = range.until;
    },
  };
}

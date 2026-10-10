import { MAIN_TEMPO, barOfTick, phraseOfTick, type Tempo } from '../shared/tempo';
import { setTempo } from '../sim/lineup';
import type { GameStatus, SetProgress, SetSegment, SimState } from '../sim/state';
import {
  LATE_TOLERANCE_SECONDS,
  LOOKAHEAD_SECONDS,
  barSeconds,
  firstStepAtOrAfter,
  follow,
  sixteenthSeconds,
  stepsToSchedule,
  tickToTime,
  timeToTick,
  type Anchor,
} from './clock';
import { createFader } from './fade';
import type { MusicLayer, MusicPart, MusicTrack, SetDefinition } from '../data/types';
import { DRUM_VOICES } from './drums';
import { createReverb, type Acoustics, type Reverb } from './reverb';
import { SUNRISE_SEMITONES, chordRootOfBar, keyHz, midiToHz, type MusicKey } from './scale';
import {
  SPEAKER_LAYER_IDS,
  SPEAKER_VOICES,
  entryTickOf,
  isSpeakerLayerId,
  presenceAt,
  type SpeakerLayerId,
} from './speaker-layers';
import { playNoise, playTone } from './synth';
import { MUSIC_VOICES } from './voices';

export type MusicMode = 'playing' | 'won' | 'lost';

export interface Layers {
  kick: boolean;
  bass: boolean;
  hats: boolean;
  hats16: boolean;
  clap: boolean;
  pad: boolean;
  texture: boolean;
  arp: boolean;
  lead: boolean;
  squelch: boolean;
  theme: boolean;
  speakers: readonly SpeakerLayerId[];
  leadCutoff: number;
  bassCutoff: number;
}

export interface BreakCue {
  roll: number | null;
  cut: boolean;
}

export interface MusicOptions {
  track: MusicTrack;
  breakBars: (tier: number) => number;
  // The set a game plays: its beat length and its room. Absent means the main stage.
  setOf?: ((setId: string) => SetDefinition | undefined) | undefined;
  onKickScheduled: ((tick: number, time: number) => void) | undefined;
}

export interface Music {
  update(state: SimState, now: number, currentTime: number): void;
  // When the set can give way to the menus: now during a game, after the ending once it is over.
  menuAt(currentTime: number): number;
  // Fades the set out over one bar, still in rhythm, and returns the next beat of its grid.
  fadeOut(currentTime: number): number;
  // Fades the set back in over one bar, on the grid of the next update.
  fadeIn(): void;
  setTrack(track: MusicTrack): void;
  // The tempo of the set it plays, the main stage's before any set.
  tempo(): Tempo;
}

export interface Threshold {
  below: number;
  offAt: number;
}

interface Bus {
  input: BiquadFilterNode;
  cutoff: number;
  output: GainNode;
  lead: GainNode;
  echoFeedback: GainNode;
  echoReturn: GainNode;
  reverb: Reverb | null;
}

export const THEME_TIER = 1;
export const ROLL_BARS = 3;
export const PULSE: Threshold = { below: 0.25, offAt: 0.27 };
export const CHOKE: Threshold = { below: 0.1, offAt: 0.12 };

const CUT_SECONDS = 0.02;
const WON_FADE_SECONDS = 1.5;
const SUNRISE_ATTACK = 4;
const SUNRISE_HOLD = 12;
const EXTINCTION_SECONDS = 1.6;
const BUS_TAIL_SECONDS = 2;
const RISER_LOW_HZ = 300;
const RISER_HIGH_HZ = 7000;
const PAD_HZ = 900;
const PAD_RELEASE = 0.6;
const PAD_CUT_RELEASE = 0.05;
const ECHO_FEEDBACK = 0.38;
const ECHO_RETURN = 0.32;
const CRASH_EVERY_BARS = 8;
const NO_CUE: BreakCue = { roll: null, cut: false };
const OPEN_HZ = 20_000;
const CHOKED_HZ = 380;
const CHOKE_TOP_HZ = 3000;
const CHOKE_SMOOTHING = 0.12;
const PULSE_GLIDE = 0.12;

export function latched(on: boolean, life: number, threshold: Threshold): boolean {
  return life < (on ? threshold.offAt : threshold.below);
}

export function pulseGain(sixteenth: number, pulse: boolean, choke: boolean): number {
  if (!pulse || (sixteenth >= 8 && !choke)) {
    return 0;
  }
  switch (sixteenth % 8) {
    case 2:
      return 0.55;
    case 3:
      return 0.4;
    default:
      return 0;
  }
}

export function musicCutoff(choke: boolean, life: number): number {
  return choke
    ? CHOKED_HZ * (CHOKE_TOP_HZ / CHOKED_HZ) ** (Math.max(0, life) / CHOKE.below)
    : OPEN_HZ;
}

export function modeOf(status: GameStatus): MusicMode {
  if (status === 'won' || status === 'lost') {
    return status;
  }
  return 'playing';
}

export function phraseAt(
  progress: SetProgress,
  fromTick: number,
  tick: number,
  tempo: Tempo = MAIN_TEMPO,
): number {
  return progress.phrase + phraseOfTick(tick, tempo) - phraseOfTick(fromTick, tempo);
}

export function dropTickOf(
  progress: SetProgress,
  breakBars: number,
  tempo: Tempo = MAIN_TEMPO,
): number | null {
  return progress.segment === 'break'
    ? progress.segmentStartTick + breakBars * tempo.ticksPerBar
    : null;
}

export function segmentAt(segment: SetSegment, dropTick: number | null, tick: number): SetSegment {
  return segment === 'break' && dropTick !== null && tick >= dropTick ? 'drop' : segment;
}

export function breakCueAt(
  dropTick: number | null,
  tick: number,
  tempo: Tempo = MAIN_TEMPO,
): BreakCue {
  const left = dropTick === null ? 0 : dropTick - tick;
  const { ticksPerBeat, ticksPerBar } = tempo;
  const stepTicks = ticksPerBeat / 4;
  if (left <= 0 || left > ROLL_BARS * ticksPerBar) {
    return NO_CUE;
  }
  if (left <= ticksPerBeat) {
    return { roll: null, cut: true };
  }
  if (left <= 2 * ticksPerBeat) {
    return { roll: stepTicks / 2, cut: false };
  }
  if (left <= ticksPerBar) {
    return { roll: stepTicks, cut: false };
  }
  return { roll: left <= 2 * ticksPerBar ? 2 * stepTicks : ticksPerBeat, cut: false };
}

export function layersFor(
  segment: SetSegment,
  tier: number,
  phrase: number,
  heard: readonly string[] = [],
): Layers {
  const speakers = SPEAKER_LAYER_IDS.filter((id) => heard.includes(id));
  return { ...segmentLayers(segment, tier, phrase), speakers };
}

function segmentLayers(
  segment: SetSegment,
  tier: number,
  phrase: number,
): Omit<Layers, 'speakers'> {
  switch (segment) {
    case 'buildup':
      return {
        kick: true,
        bass: true,
        hats: true,
        hats16: tier >= 1,
        clap: false,
        pad: phrase >= 1,
        texture: phrase >= 1,
        arp: phrase >= 2,
        lead: phrase >= 3 || tier >= 1,
        squelch: tier >= 1,
        theme: tier >= THEME_TIER,
        leadCutoff: 900 + 700 * tier,
        bassCutoff: 700 + 150 * tier,
      };
    case 'break':
      return {
        kick: false,
        bass: false,
        hats: false,
        hats16: false,
        clap: false,
        pad: true,
        texture: true,
        arp: false,
        lead: true,
        squelch: false,
        theme: true,
        leadCutoff: 1100,
        bassCutoff: 0,
      };
    case 'drop':
      return {
        kick: true,
        bass: true,
        hats: true,
        hats16: true,
        clap: true,
        pad: true,
        texture: true,
        arp: true,
        lead: true,
        squelch: true,
        theme: true,
        leadCutoff: 3200 + 800 * tier,
        bassCutoff: 1000 + 150 * tier,
      };
  }
}

function keyOf(track: MusicTrack, layers: Layers): MusicKey {
  return layers.theme && track.themeScale !== undefined
    ? { rootMidi: track.rootMidi, scale: track.themeScale }
    : track;
}

function isOn(layers: Layers, layer: MusicLayer): boolean {
  switch (layer) {
    case 'lead':
      return layers.lead && !layers.theme;
    case 'theme':
      return layers.lead && layers.theme;
    default:
      return layers[layer];
  }
}

function partHz(part: MusicPart, degree: number, chord: number, key: MusicKey): number {
  return keyHz(key, part.followsChord ? chord + degree : degree, part.octave);
}

function kick(out: AudioNode, at: number, track: MusicTrack) {
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

function pulse(out: AudioNode, at: number, gain: number, track: MusicTrack) {
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

function hat(out: AudioNode, at: number, open: boolean, pan: number) {
  playNoise(out, at, {
    gain: open ? 0.28 : 0.14,
    attack: 0.001,
    hold: 0,
    release: open ? 0.12 : 0.035,
    pan,
    filter: { type: 'highpass', hz: 7000 },
  });
}

function clap(out: AudioNode, at: number) {
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

function crash(out: AudioNode, at: number, gain: number) {
  playNoise(out, at, {
    gain,
    attack: 0.002,
    hold: 0.02,
    release: 1.8,
    filter: { type: 'highpass', hz: 5500 },
  });
}

function snare(out: AudioNode, at: number, progress: number, key: MusicKey) {
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

function pad(
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

function riser(out: AudioNode, from: number, until: number, progress: number, key: MusicKey) {
  const seconds = until - from;
  const done = Math.min(1, Math.max(0, progress));
  playNoise(out, from, {
    gain: 0.15,
    attack: seconds,
    hold: 0,
    release: 0.03,
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
    hz: keyHz(key, 0, 2) * 4 ** done,
    toHz: keyHz(key, 0, 4),
    glide: seconds,
    gain: 0.03,
    attack: seconds,
    hold: 0,
    release: 0.03,
    filter: { type: 'lowpass', hz: 3000 },
  });
}

function downlifter(out: AudioNode, at: number) {
  playNoise(out, at, {
    gain: 0.2,
    attack: 0.005,
    hold: 0.1,
    release: 2.4,
    filter: { type: 'bandpass', hz: 6000, toHz: 300, glide: 2.4, q: 1.2 },
  });
  crash(out, at, 0.09);
}

function impact(out: AudioNode, at: number) {
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

function sunrise(out: AudioNode, at: number, key: MusicKey) {
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
}

export function padCutoff(
  track: MusicTrack,
  segment: SetSegment,
  progress: SetProgress,
  bar: number,
  tempo: Tempo = MAIN_TEMPO,
) {
  return segment === 'break'
    ? PAD_HZ + (track.padOpens ?? 0) * (bar - barOfTick(progress.segmentStartTick, tempo))
    : PAD_HZ;
}

function powerDown(out: AudioNode, at: number, key: MusicKey) {
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
}

export function createMusic(out: AudioNode, options: MusicOptions): Music {
  let { track } = options;
  let tempo = MAIN_TEMPO;
  let acoustics: Acoustics | undefined;
  let setId: string | null = null;
  const context = out.context;
  const level = context.createGain();
  const fader = createFader(level.gain, context, 1, () => barSeconds(tempo));
  level.connect(out);
  let bus: Bus | null = null;
  let last: SimState | null = null;
  let endsAt = 0;
  let anchor: Anchor | null = null;
  let cursor = 0;
  let mode: MusicMode | null = null;
  let segment: SetSegment | null = null;
  let tier = 0;
  let dropTick: number | null = null;
  let followedTick = -1;
  let pulsing = false;
  let choking = false;
  const entries = new Map<SpeakerLayerId, number>();
  const stepTicks = () => tempo.ticksPerBeat / 4;
  const sixteenthLength = () => sixteenthSeconds(tempo);
  const plugging = new Set<SpeakerLayerId>();

  function openBus(cutoff = OPEN_HZ): Bus {
    const input = context.createBiquadFilter();
    input.type = 'lowpass';
    input.frequency.value = cutoff;
    input.Q.value = 0.7;
    const output = context.createGain();
    input.connect(output);
    output.connect(level);
    const lead = context.createGain();
    const echo = context.createDelay(1);
    echo.delayTime.value = 3 * sixteenthLength();
    const echoTone = context.createBiquadFilter();
    echoTone.type = 'lowpass';
    echoTone.frequency.value = 2600;
    const echoFeedback = context.createGain();
    echoFeedback.gain.value = ECHO_FEEDBACK;
    const echoReturn = context.createGain();
    echoReturn.gain.value = ECHO_RETURN;
    lead.connect(input);
    lead.connect(echo);
    echo.connect(echoTone);
    echoTone.connect(echoFeedback);
    echoFeedback.connect(echo);
    echoTone.connect(echoReturn);
    echoReturn.connect(input);
    const reverb = acoustics === undefined ? null : createReverb(output, acoustics);
    if (reverb !== null) {
      input.connect(reverb.input);
    }
    bus = { input, cutoff, output, lead, echoFeedback, echoReturn, reverb };
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
        old.echoFeedback.disconnect();
        old.reverb?.disconnect();
      },
      (fadeSeconds + LOOKAHEAD_SECONDS + BUS_TAIL_SECONDS) * 1000,
    );
  }

  function setEcho(target: Bus, at: number, open: boolean) {
    target.echoFeedback.gain.setTargetAtTime(open ? ECHO_FEEDBACK : 0, at, 0.01);
    target.echoReturn.gain.setTargetAtTime(open ? ECHO_RETURN : 0, at, 0.01);
  }

  function extinguish(at: number) {
    if (bus !== null) {
      bus.input.frequency.setValueAtTime(bus.input.frequency.value, at);
      bus.input.frequency.exponentialRampToValueAtTime(60, at + EXTINCTION_SECONDS);
    }
    retire(bus, EXTINCTION_SECONDS);
    powerDown(openBus().input, at, track);
  }

  function cutTime(clock: Anchor): number {
    return dropTick === null ? Infinity : tickToTime(clock, dropTick - tempo.ticksPerBeat);
  }

  function sustain(target: Bus, state: SimState, from: number, clock: Anchor) {
    const { set, tick } = state;
    const layers = layersFor(set.segment, set.tier, set.phrase);
    const bar = barOfTick(tick, tempo);
    const barEnd = tickToTime(clock, (bar + 1) * tempo.ticksPerBar);
    const end = Math.min(barEnd, cutTime(clock));
    if (layers.pad && tick % tempo.ticksPerBar !== 0 && end > from) {
      const release = end < barEnd ? PAD_CUT_RELEASE : PAD_RELEASE;
      pad(
        target.input,
        from,
        chordRootOfBar(track.chords, bar),
        end - from,
        CUT_SECONDS,
        release,
        keyOf(track, layers),
        padCutoff(track, set.segment, set, bar, tempo),
      );
    }
    if (dropTick !== null) {
      const start = tickToTime(clock, set.segmentStartTick);
      const cut = cutTime(clock);
      if (cut - from > sixteenthLength()) {
        riser(target.input, from, cut, (from - start) / (cut - start), track);
      }
    }
  }

  function followSpeakers(state: SimState) {
    plugging.clear();
    const plugged = new Set<string>();
    for (const speaker of state.speakers ?? []) {
      if (!isSpeakerLayerId(speaker.id)) {
        continue;
      }
      if (speaker.plugged) {
        plugged.add(speaker.id);
        if (!entries.has(speaker.id)) {
          entries.set(speaker.id, entryTickOf(state.tick, cursor, tempo));
        }
      } else if (speaker.plugTicks > 0) {
        plugging.add(speaker.id);
      }
    }
    for (const id of [...entries.keys()]) {
      if (!plugged.has(id)) {
        entries.delete(id);
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
    const input = target.input;
    if (current !== state.set.segment && step === dropTick) {
      impact(input, at);
      setEcho(target, at, true);
    }
    const cue = current === 'break' ? breakCueAt(dropTick, step, tempo) : NO_CUE;
    if (cue.cut) {
      if (dropTick !== null && step === dropTick - tempo.ticksPerBeat) {
        setEcho(target, at, false);
      }
      return;
    }
    const layers = layersFor(current, tier, phraseAt(state.set, state.tick, step, tempo), [
      ...entries.keys(),
      ...plugging,
    ]);
    const key = keyOf(track, layers);
    const bar = barOfTick(step, tempo);
    const sixteenth = Math.round((step % tempo.ticksPerBar) / stepTicks());
    const thump = pulseGain(sixteenth, pulsing, choking);
    if (thump > 0) {
      pulse(input, at, thump, track);
    }
    const inBeat = sixteenth % 4;
    const chord = chordRootOfBar(track.chords, bar);
    const light = current === 'break';
    const until = light ? cutTime(clock) : Infinity;
    if (track.drums === undefined) {
      if (inBeat === 0 && layers.kick) {
        kick(input, at, track);
        options.onKickScheduled?.(step, at);
      }
      if (layers.hats && inBeat === 2) {
        hat(input, at, true, 0);
      } else if (layers.hats16 && inBeat !== 0) {
        hat(input, at, false, inBeat === 1 ? -0.25 : 0.25);
      }
      if (layers.clap && (sixteenth === 4 || sixteenth === 12)) {
        clap(input, at);
      }
    } else {
      for (const drum of track.drums) {
        const position = (sixteenth + 16 * bar) % drum.loopSteps;
        const hit = drum.hits.find(([hitStep]) => hitStep === position);
        if (hit === undefined || !isOn(layers, drum.layer)) {
          continue;
        }
        DRUM_VOICES[drum.voice]({
          out: input,
          at,
          gain: hit[1],
          pan: drum.pan,
          kick: {
            fromHz: track.kick.fromHz,
            toHz: keyHz(track, 0, 0),
            release: track.kick.release,
          },
        });
        if (drum.voice === 'kick') {
          options.onKickScheduled?.(step, at);
        }
      }
    }
    if (layers.kick && sixteenth === 0 && bar % CRASH_EVERY_BARS === 0 && step !== dropTick) {
      crash(input, at, 0.07);
    }
    if (cue.roll !== null && dropTick !== null) {
      const left = dropTick - step;
      if (left % Math.max(cue.roll, stepTicks()) === 0) {
        const { ticksPerBeat, ticksPerBar } = tempo;
        const progress = 1 - (left - ticksPerBeat) / (ROLL_BARS * ticksPerBar - ticksPerBeat);
        const hits = Math.max(1, stepTicks() / cue.roll);
        for (let hit = 0; hit < hits; hit += 1) {
          snare(input, at + (hit * sixteenthLength()) / hits, progress, track);
        }
      }
    }
    for (const part of track.parts) {
      if (!isOn(layers, part.layer) || (part.in !== undefined && (part.in === 'light') !== light)) {
        continue;
      }
      const position = (sixteenth + 16 * bar) % part.loopSteps;
      const index = part.notes.findIndex(([noteStep]) => noteStep === position);
      const note = part.notes[index];
      const previous = part.notes[(index + part.notes.length - 1) % part.notes.length];
      if (note === undefined || previous === undefined) {
        continue;
      }
      MUSIC_VOICES[part.voice]({
        out: input,
        send: target.lead,
        at,
        step,
        tempo,
        position,
        hz: partHz(part, note[1], chord, key),
        fromHz: partHz(part, previous[1], chord, key),
        steps: note[2],
        cutoff: part.layer === 'bass' ? layers.bassCutoff : layers.leadCutoff,
        light,
        until,
        accent: part.accents?.includes(position) ?? false,
        slide: part.slides?.includes(position) ?? false,
        legato: part.slides?.includes((position + 1) % part.loopSteps) ?? false,
      });
    }
    for (const id of layers.speakers) {
      SPEAKER_VOICES[id]({
        out: input,
        at,
        bar,
        sixteenth,
        chord,
        key,
        kick: layers.kick,
        light,
        tempo,
        ...presenceAt(step, entries.get(id) ?? null, light, tempo),
      });
    }
    if (layers.pad && sixteenth === 0) {
      const barEnd = tickToTime(clock, (bar + 1) * tempo.ticksPerBar);
      const end = Math.min(barEnd, until);
      const release = end < barEnd ? PAD_CUT_RELEASE : PAD_RELEASE;
      pad(
        input,
        at,
        chord,
        end - at,
        0.3,
        release,
        key,
        padCutoff(track, current, state.set, bar, tempo),
      );
    }
  }

  return {
    setTrack(next) {
      track = next;
    },
    tempo() {
      return tempo;
    },
    update(state, now, currentTime) {
      last = state;
      if (state.setId !== setId) {
        setId = state.setId;
        const set = options.setOf?.(setId);
        tempo = set === undefined ? MAIN_TEMPO : setTempo(set);
        acoustics = set?.acoustics;
        anchor = null;
        followedTick = -1;
      }
      const nextMode = modeOf(state.status);
      if (nextMode !== mode) {
        mode = nextMode;
        anchor = null;
        segment = null;
        if (nextMode === 'won') {
          retire(bus, WON_FADE_SECONDS);
          sunrise(openBus().input, currentTime, track);
          endsAt = currentTime + SUNRISE_ATTACK + SUNRISE_HOLD;
        } else if (nextMode === 'lost') {
          extinguish(currentTime);
          endsAt = currentTime + EXTINCTION_SECONDS;
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
      dropTick = dropTickOf(set, set.segment === 'break' ? options.breakBars(set.tier) : 0, tempo);
      const { core } = state;
      const life = core.maxHp > 0 ? core.hp / core.maxHp : 1;
      pulsing = latched(pulsing, life, PULSE);
      choking = latched(choking, life, CHOKE);
      const cutoff = musicCutoff(choking, life);
      let target = bus;
      if (target === null || followed.resynced || entered) {
        retire(bus, CUT_SECONDS);
        target = openBus(cutoff);
        cursor = firstStepAtOrAfter(
          followed.resynced ? state.tick : Math.max(state.tick, timeToTick(clock, currentTime)),
          stepTicks(),
        );
        const at = Math.max(tickToTime(clock, state.tick), currentTime);
        if (entered && previous !== null && set.segment === 'drop') {
          impact(target.input, at);
        } else if (entered && previous !== null && set.segment === 'break') {
          downlifter(target.input, at);
        }
        sustain(target, state, currentTime, clock);
      }

      if (cutoff !== target.cutoff) {
        target.input.frequency.setTargetAtTime(cutoff, currentTime, CHOKE_SMOOTHING);
        target.cutoff = cutoff;
      }
      followSpeakers(state);
      const range = stepsToSchedule(
        clock,
        cursor,
        currentTime - LATE_TOLERANCE_SECONDS,
        currentTime + LOOKAHEAD_SECONDS,
        stepTicks(),
      );
      for (let step = range.from; step < range.until; step += stepTicks()) {
        playStep(target, step, state, clock, currentTime);
      }
      cursor = range.until;
    },
    menuAt(currentTime) {
      return mode === 'won' || mode === 'lost' ? Math.max(currentTime, endsAt) : currentTime;
    },
    fadeOut(currentTime) {
      fader.to(0);
      if (mode !== 'playing' || bus === null || anchor === null || last === null) {
        return currentTime;
      }
      const clock = anchor;
      const range = stepsToSchedule(
        clock,
        cursor,
        currentTime - LATE_TOLERANCE_SECONDS,
        currentTime + barSeconds(tempo),
        stepTicks(),
      );
      const until = Math.min(range.until, dropTick ?? Infinity);
      for (let step = range.from; step < until; step += stepTicks()) {
        playStep(bus, step, last, clock, currentTime);
      }
      cursor = Math.max(cursor, until);
      anchor = null;
      const beat =
        Math.ceil(timeToTick(clock, currentTime) / tempo.ticksPerBeat) * tempo.ticksPerBeat;
      return Math.max(currentTime, tickToTime(clock, beat));
    },
    fadeIn() {
      fader.to(1);
      anchor = null;
    },
  };
}

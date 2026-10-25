import type { MusicLayer, MusicPart, MusicTrack } from '../data/types';
import { barOfTick, isBarTick, ticksIntoBar, type Tempo } from '../shared/tempo';
import type { SetProgress, SetSegment, SimState } from '../sim/state';
import { sixteenthSeconds, sixteenthTicks, tickToTime, type Anchor } from './clock';
import { DRUM_VOICES } from './drums';
import { setEcho, type Bus } from './music-bus';
import { clap, crash, hat, impact, kick, pad, pulse, riser, snare } from './music-hits';
import {
  NO_CUE,
  breakCueAt,
  layersFor,
  padCutoff,
  partHeard,
  phraseAt,
  pulseGain,
  rollProgress,
  segmentAt,
  type BreakCue,
  type Layers,
} from './music-score';
import { chordRootOfBar, keyHz, type MusicKey } from './scale';
import { SPEAKER_VOICES, presenceAt, type SpeakerLayerId } from './speaker-layers';
import { MUSIC_VOICES } from './voices';

export interface Groove {
  track: MusicTrack;
  tempo: Tempo;
  tier: number;
  dropTick: number | null;
  pulsing: boolean;
  choking: boolean;
  entries: ReadonlyMap<SpeakerLayerId, number>;
  plugging: ReadonlyMap<SpeakerLayerId, number>;
  onKick: ((tick: number, time: number) => void) | undefined;
}

interface Beat {
  target: Bus;
  input: AudioNode;
  at: number;
  step: number;
  segment: SetSegment;
  layers: Layers;
  key: MusicKey;
  bar: number;
  sixteenth: number;
  chord: number;
  light: boolean;
  until: number;
}

type Playing = Pick<SimState, 'set' | 'tick'>;

export const CUT_SECONDS = 0.02;
const PAD_RELEASE = 0.6;
const PAD_CUT_RELEASE = 0.05;
const CRASH_EVERY_BARS = 8;

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

function cutTime({ dropTick, tempo }: Groove, clock: Anchor): number {
  return dropTick === null ? Infinity : tickToTime(clock, dropTick - tempo.ticksPerBeat);
}

function barEndTime(tempo: Tempo, clock: Anchor, bar: number): number {
  return tickToTime(clock, tempo.originTick + (bar + 1) * tempo.ticksPerBar);
}

export function sustain(groove: Groove, target: Bus, state: Playing, from: number, clock: Anchor) {
  const { track, tempo, dropTick } = groove;
  const { set, tick } = state;
  const layers = layersFor(set.segment, set.tier, set.phrase);
  const bar = barOfTick(tick, tempo);
  const barEnd = barEndTime(tempo, clock, bar);
  const end = Math.min(barEnd, cutTime(groove, clock));
  if (layers.pad && !isBarTick(tick, tempo) && end > from) {
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
    const cut = cutTime(groove, clock);
    if (cut - from > sixteenthSeconds(tempo)) {
      riser(target.input, from, cut, (from - start) / (cut - start), track);
    }
  }
}

export function playStep(
  groove: Groove,
  target: Bus,
  timeStep: number,
  state: Playing,
  clock: Anchor,
  currentTime: number,
  step = timeStep,
) {
  const { track, tempo, dropTick } = groove;
  const at = Math.max(tickToTime(clock, timeStep), currentTime);
  const current = segmentAt(state.set.segment, dropTick, step);
  if (current !== state.set.segment && step === dropTick) {
    impact(target.input, at);
    setEcho(target, at, true);
  }
  const cue = current === 'break' ? breakCueAt(dropTick, step, tempo) : NO_CUE;
  if (cue.cut) {
    if (dropTick !== null && step === dropTick - tempo.ticksPerBeat) {
      setEcho(target, at, false);
    }
    return;
  }
  const beat = beatOf(groove, target, at, step, current, state, clock);
  const thump = pulseGain(beat.sixteenth, groove.pulsing, groove.choking);
  if (thump > 0) {
    pulse(beat.input, at, thump, track);
  }
  if (track.drums === undefined) {
    playEngineKit(groove, beat);
  } else {
    playTrackKit(groove, track.drums, beat);
  }
  const { layers, sixteenth, bar } = beat;
  if (layers.kick && sixteenth === 0 && bar % CRASH_EVERY_BARS === 0 && step !== dropTick) {
    crash(beat.input, at, 0.07);
  }
  playRoll(groove, cue, beat);
  playParts(groove, beat);
  playSpeakers(groove, beat);
  if (layers.pad && sixteenth === 0) {
    playBarPad(groove, state.set, clock, beat);
  }
}

function beatOf(
  groove: Groove,
  target: Bus,
  at: number,
  step: number,
  segment: SetSegment,
  state: Playing,
  clock: Anchor,
): Beat {
  const { track, tempo, tier, entries, plugging } = groove;
  const phrase = phraseAt(state.set, state.tick, step, tempo);
  const layers = layersFor(segment, tier, phrase, [...entries.keys(), ...plugging.keys()]);
  const bar = barOfTick(step, tempo);
  const light = segment === 'break';
  return {
    target,
    input: target.input,
    at,
    step,
    segment,
    layers,
    key: keyOf(track, layers),
    bar,
    sixteenth: Math.round(ticksIntoBar(step, tempo) / sixteenthTicks(tempo)),
    chord: chordRootOfBar(track.chords, bar),
    light,
    until: light ? cutTime(groove, clock) : Infinity,
  };
}

function playEngineKit({ track, onKick }: Groove, beat: Beat) {
  const { input, at, step, layers, sixteenth } = beat;
  const inBeat = sixteenth % 4;
  if (inBeat === 0 && layers.kick) {
    kick(input, at, track);
    onKick?.(step, at);
  }
  if (layers.hats && inBeat === 2) {
    hat(input, at, true, 0);
  } else if (layers.hats16 && inBeat !== 0) {
    hat(input, at, false, inBeat === 1 ? -0.25 : 0.25);
  }
  if (layers.clap && (sixteenth === 4 || sixteenth === 12)) {
    clap(input, at);
  }
}

function playTrackKit(
  { track, onKick }: Groove,
  drums: NonNullable<MusicTrack['drums']>,
  beat: Beat,
) {
  const { input, at, step, layers, sixteenth, bar, segment } = beat;
  for (const drum of drums) {
    const position = (sixteenth + 16 * bar) % drum.loopSteps;
    const hit = drum.hits.find(([hitStep]) => hitStep === position);
    if (hit === undefined || !isOn(layers, drum.layer) || !partHeard(drum.in, segment)) {
      continue;
    }
    DRUM_VOICES[drum.voice]({
      out: input,
      at,
      gain: hit[1],
      pan: drum.pan,
      hz: drum.hz,
      release: drum.release,
      kick: {
        fromHz: track.kick.fromHz,
        toHz: keyHz(track, 0, 0),
        release: track.kick.release,
      },
    });
    if (drum.voice === 'kick' || drum.voice === 'tuned-kick') {
      onKick?.(step, at);
    }
  }
}

function playRoll({ track, tempo, dropTick }: Groove, cue: BreakCue, beat: Beat) {
  if (cue.roll === null || dropTick === null || track.build === 'soft') {
    return;
  }
  const stepTicks = sixteenthTicks(tempo);
  const left = dropTick - beat.step;
  if (left % Math.max(cue.roll, stepTicks) !== 0) {
    return;
  }
  const progress = rollProgress(left, tempo);
  const hits = Math.max(1, stepTicks / cue.roll);
  for (let hit = 0; hit < hits; hit += 1) {
    snare(beat.input, beat.at + (hit * sixteenthSeconds(tempo)) / hits, progress, track);
  }
}

function playParts({ track, tempo }: Groove, beat: Beat) {
  const { target, input, at, step, layers, key, bar, sixteenth, chord, light, until } = beat;
  for (const part of track.parts) {
    if (!isOn(layers, part.layer) || !partHeard(part.in, beat.segment)) {
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
      echo: target.echo,
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
      gain: part.gain ?? 1,
    });
  }
}

function playSpeakers({ tempo, entries, plugging }: Groove, beat: Beat) {
  const { input, at, step, layers, key, bar, sixteenth, chord, light } = beat;
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
      ...presenceAt(step, entries.get(id) ?? null, plugging.get(id) ?? 0, light),
    });
  }
}

function playBarPad({ track, tempo }: Groove, set: SetProgress, clock: Anchor, beat: Beat) {
  const { input, at, segment, key, bar, chord, until } = beat;
  const barEnd = barEndTime(tempo, clock, bar);
  const end = Math.min(barEnd, until);
  const release = end < barEnd ? PAD_CUT_RELEASE : PAD_RELEASE;
  pad(input, at, chord, end - at, 0.3, release, key, padCutoff(track, segment, set, bar, tempo));
}

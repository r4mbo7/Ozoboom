import { TICKS_PER_BEAT } from '../shared/tempo';
import { TICK_SECONDS } from './clock';
import { createFader } from './fade';
import { midiToHz } from './scale';
import { playTone } from './synth';

export interface AmbienceChord {
  readonly bass: number;
  readonly tones: readonly number[];
}

export type AmbienceVoice = 'pad' | 'drone' | 'arp';

export interface AmbienceNote {
  readonly voice: AmbienceVoice;
  readonly midi: number;
  readonly eighths: number;
}

export interface Ambience {
  // Fades in from now, its first note on `origin` when it was silent.
  enter(origin: number): void;
  leave(): void;
  // Schedules what comes next; false once it is silent and has nothing left to play.
  pump(): boolean;
}

// Half time: an eighth note of the ambience lasts one beat of the set.
export const EIGHTH_SECONDS = TICKS_PER_BEAT * TICK_SECONDS;
export const CHORD_EIGHTHS = 16;
// F sharp without a third: neither the A of the phrygian set nor the A sharp of the hijaz one.
export const AMBIENCE_CHORDS: readonly AmbienceChord[] = [
  { bass: 42, tones: [54, 61, 64, 71] },
  { bass: 38, tones: [50, 54, 59, 61] },
  { bass: 40, tones: [52, 59, 62, 66] },
  { bass: 37, tones: [49, 52, 59, 66] },
];
const ARP_PATTERN = [0, 2, 1, 3, null, 2, 4, null, 0, 3, 1, 4, null, 2, null, 1] as const;

const LOOKAHEAD_SECONDS = 1.5;
const LATE_SECONDS = 0.05;
const PAD_ATTACK = 2;
const PAD_RELEASE = 2.5;
const CATCH_UP_ATTACK = 0.5;
const RHYTHM_DUCK_SECONDS = 0.12;
const ECHO_SECONDS = 1.5 * EIGHTH_SECONDS;
const ECHO_FEEDBACK = 0.4;
const ECHO_RETURN = 0.3;

export function ambienceChordAt(index: number): AmbienceChord {
  const size = AMBIENCE_CHORDS.length;
  const chord = AMBIENCE_CHORDS[((Math.floor(index / CHORD_EIGHTHS) % size) + size) % size];
  if (chord === undefined) {
    throw new RangeError(`index must be a whole number, got ${String(index)}`);
  }
  return chord;
}

function arpPool(chord: AmbienceChord): number[] {
  const pool = chord.tones.map((midi) => midi + 12);
  return [...pool, (pool[0] ?? 0) + 12];
}

export function ambienceNotesAt(index: number): AmbienceNote[] {
  const chord = ambienceChordAt(index);
  const position = index % CHORD_EIGHTHS;
  const notes: AmbienceNote[] = [];
  if (position === 0) {
    notes.push({ voice: 'drone', midi: chord.bass, eighths: CHORD_EIGHTHS });
    for (const midi of chord.tones) {
      notes.push({ voice: 'pad', midi, eighths: CHORD_EIGHTHS });
    }
  }
  const step = ARP_PATTERN[position] ?? null;
  const midi = step === null ? undefined : arpPool(chord)[step];
  if (midi !== undefined) {
    notes.push({ voice: 'arp', midi, eighths: 1 });
  }
  return notes;
}

function pad(out: AudioNode, at: number, midi: number, seconds: number, attack: number) {
  for (const detune of [-7, 7]) {
    playTone(out, at, {
      wave: 'sawtooth',
      hz: midiToHz(midi),
      detune,
      gain: 0.052,
      attack: Math.min(attack, seconds),
      hold: Math.max(0, seconds - attack),
      release: PAD_RELEASE,
      pan: detune < 0 ? -0.35 : 0.35,
      filter: { type: 'lowpass', hz: 700, toHz: 1600, glide: seconds / 2 },
    });
  }
}

function drone(out: AudioNode, at: number, midi: number, seconds: number, attack: number) {
  const envelope = {
    attack: Math.min(attack, seconds),
    hold: Math.max(0, seconds - attack),
    release: PAD_RELEASE,
  };
  playTone(out, at, { ...envelope, wave: 'sine', hz: midiToHz(midi), gain: 0.075 });
  playTone(out, at, { ...envelope, wave: 'triangle', hz: midiToHz(midi + 12), gain: 0.038 });
}

function arp(out: AudioNode, at: number, midi: number, index: number) {
  const pan = index % 2 === 0 ? -0.35 : 0.35;
  playTone(out, at, {
    wave: 'triangle',
    hz: midiToHz(midi),
    gain: 0.13,
    attack: 0.008,
    hold: 0.04,
    release: 1.1,
    pan,
    filter: { type: 'lowpass', hz: 2600 },
  });
  playTone(out, at, {
    wave: 'sine',
    hz: midiToHz(midi + 12),
    gain: 0.018,
    attack: 0.005,
    hold: 0.02,
    release: 0.6,
    pan,
  });
}

export function createAmbience(out: AudioNode): Ambience {
  const context = out.context;
  const level = context.createGain();
  const fader = createFader(level.gain, context, 0);
  level.connect(out);
  const rhythm = context.createGain();
  const echo = context.createDelay(2);
  echo.delayTime.value = ECHO_SECONDS;
  const echoTone = context.createBiquadFilter();
  echoTone.type = 'lowpass';
  echoTone.frequency.value = 1800;
  const echoFeedback = context.createGain();
  echoFeedback.gain.value = ECHO_FEEDBACK;
  const echoReturn = context.createGain();
  echoReturn.gain.value = ECHO_RETURN;
  rhythm.connect(level);
  rhythm.connect(echo);
  echo.connect(echoTone);
  echoTone.connect(echoFeedback);
  echoFeedback.connect(echo);
  echoTone.connect(echoReturn);
  echoReturn.connect(level);

  let origin: number | null = null;
  let cursor = 0;
  let stopAt: number | null = null;

  function play(index: number, at: number) {
    for (const note of ambienceNotesAt(index)) {
      const seconds = note.eighths * EIGHTH_SECONDS;
      if (note.voice === 'pad') {
        pad(level, at, note.midi, seconds, PAD_ATTACK);
      } else if (note.voice === 'drone') {
        drone(level, at, note.midi, seconds, PAD_ATTACK);
      } else {
        arp(rhythm, at, note.midi, index);
      }
    }
  }

  // After a stall (a throttled timer), the missed notes are dropped but the chord keeps ringing.
  function catchUp(start: number, index: number, now: number) {
    const chordStart = index - (index % CHORD_EIGHTHS);
    if (chordStart === index) {
      return;
    }
    const seconds = start + (chordStart + CHORD_EIGHTHS) * EIGHTH_SECONDS - now;
    const chord = ambienceChordAt(index);
    drone(level, now, chord.bass, seconds, CATCH_UP_ATTACK);
    for (const midi of chord.tones) {
      pad(level, now, midi, seconds, CATCH_UP_ATTACK);
    }
  }

  return {
    enter(at) {
      const now = context.currentTime;
      if (origin === null) {
        origin = Math.max(at, now);
        cursor = 0;
        rhythm.gain.cancelScheduledValues(now);
        rhythm.gain.setValueAtTime(1, now);
      } else {
        rhythm.gain.setTargetAtTime(1, now, RHYTHM_DUCK_SECONDS);
      }
      stopAt = null;
      fader.to(1);
    },
    leave() {
      const now = context.currentTime;
      stopAt = fader.to(0);
      rhythm.gain.setTargetAtTime(0, now, RHYTHM_DUCK_SECONDS);
    },
    pump() {
      if (origin === null) {
        return false;
      }
      const now = context.currentTime;
      if (stopAt !== null && now >= stopAt) {
        origin = null;
        return false;
      }
      const due = Math.ceil((now - LATE_SECONDS - origin) / EIGHTH_SECONDS);
      if (cursor < due) {
        catchUp(origin, due, now);
        cursor = due;
      }
      const horizon = Math.min(now + LOOKAHEAD_SECONDS, stopAt ?? Infinity);
      for (; origin + cursor * EIGHTH_SECONDS < horizon; cursor += 1) {
        play(cursor, origin + cursor * EIGHTH_SECONDS);
      }
      return true;
    },
  };
}

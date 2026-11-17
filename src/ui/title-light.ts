import { ARP_NOTES, CHORD_EIGHTHS, arpStepAt, type MenuHeard } from '../shared/menu-score';
import { clamp01, smoothstep } from '../shared/scalar';
import { TRACK_STRIKES, TRACK_SWELL } from './title-track';

export interface TitleLight {
  // The sun and the halo of the title, 0 to 1.
  readonly swell: number;
  // 0 to 1; 0 when none crosses.
  readonly sheen: number;
  // One per note of the arpeggio, from the lowest.
  readonly reflections: readonly number[];
}

export const TITLE_AT_REST: TitleLight = {
  swell: 0.6,
  sheen: 0,
  reflections: Array.from({ length: ARP_NOTES }, () => 0),
};

const RISE_END = 0.5;
const FALL_START = 0.85;
const SHEEN_EIGHTHS = 4;
const WAKE_EIGHTHS = 2;
const STRIKE_EIGHTHS = 0.06;
const FADE_EIGHTHS = 1.2;

// The pad opens over half a chord: the sun follows it, and comes down as the next chord nears.
function swellAt(eighths: number): number {
  const progress = (eighths % CHORD_EIGHTHS) / CHORD_EIGHTHS;
  if (progress < RISE_END) {
    return smoothstep(progress / RISE_END);
  }
  return progress < FALL_START ? 1 : 1 - smoothstep((progress - FALL_START) / (1 - FALL_START));
}

// `steps` per beat; `struck(step)` is the note a step strikes, or null.
function reflectionOf(
  beats: number,
  note: number,
  steps: number,
  struck: (step: number) => number | null,
): number {
  const now = Math.floor(beats * steps);
  for (let back = 0; back < CHORD_EIGHTHS * steps && back <= now; back += 1) {
    if (struck(now - back) === note) {
      const age = beats - (now - back) / steps;
      return Math.min(1, age / STRIKE_EIGHTHS) * Math.exp(-age / FADE_EIGHTHS);
    }
  }
  return 0;
}

function reflectionAt(eighths: number, note: number): number {
  return reflectionOf(eighths, note, 1, arpStepAt);
}

// The menu track loops; it strikes on its eighths, so two steps a beat.
const TRACK_BEATS = TRACK_SWELL.length / 2;

function trackDigits(digits: string, width: number, index: number): number {
  const count = digits.length / width;
  const at = ((index % count) + count) % count;
  return Number(digits.slice(at * width, at * width + width));
}

function trackStrikeAt(step: number): number | null {
  const strike = trackDigits(TRACK_STRIKES, 1, step);
  return strike === 0 ? null : strike - 1;
}

// Its loudness, between two beats where it changes.
function trackSwellAt(beats: number): number {
  const beat = Math.floor(beats);
  const from = trackDigits(TRACK_SWELL, 2, beat);
  const to = trackDigits(TRACK_SWELL, 2, beat + 1);
  return (from + (to - from) * (beats - beat)) / 99;
}

// A position earlier than the origin is a new ambience.
export function heardFrom(origin: number | null, eighths: number): number {
  return origin === null || eighths < origin ? eighths : origin;
}

function lightOf(
  beats: number,
  heardFor: number,
  swell: number,
  reflection: (note: number) => number,
): TitleLight {
  // A chord of the ambience lasts four bars, a phrase of the track.
  const inPhrase = beats % CHORD_EIGHTHS;
  const awake = smoothstep(clamp01(heardFor / WAKE_EIGHTHS));
  return {
    swell: TITLE_AT_REST.swell + (swell - TITLE_AT_REST.swell) * awake,
    sheen: inPhrase < SHEEN_EIGHTHS ? inPhrase / SHEEN_EIGHTHS : 0,
    reflections: TITLE_AT_REST.reflections.map((_, note) => reflection(note)),
  };
}

export function titleLightAt(eighths: number, heardFor = Infinity): TitleLight {
  return lightOf(eighths, heardFor, swellAt(eighths), (note) => reflectionAt(eighths, note));
}

// The sun follows the loudness of the track; a reflection lights on each onset it strikes.
export function trackLightAt(beats: number, heardFor = Infinity): TitleLight {
  return lightOf(beats, heardFor, trackSwellAt(beats % TRACK_BEATS), (note) =>
    reflectionOf(beats, note, 2, trackStrikeAt),
  );
}

export function titleLightOf(heard: MenuHeard, heardFor = Infinity): TitleLight {
  return heard.music === 'track'
    ? trackLightAt(heard.beats, heardFor)
    : titleLightAt(heard.beats, heardFor);
}

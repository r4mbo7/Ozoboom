import { ARP_NOTES, CHORD_EIGHTHS, arpStepAt } from '../shared/menu-score';

export interface TitleLight {
  // The sun and the halo of the title, from 0 to 1.
  readonly swell: number;
  // How far the sheen has crossed the title, from 0 to 1; 0 when none crosses.
  readonly sheen: number;
  // One reflection on the water per note of the arpeggio, from the lowest.
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

function ease(x: number): number {
  return x * x * (3 - 2 * x);
}

// The pad opens over half a chord: the sun follows it, and comes down as the next chord nears.
function swellAt(eighths: number): number {
  const progress = (eighths % CHORD_EIGHTHS) / CHORD_EIGHTHS;
  if (progress < RISE_END) {
    return ease(progress / RISE_END);
  }
  return progress < FALL_START ? 1 : 1 - ease((progress - FALL_START) / (1 - FALL_START));
}

function reflectionAt(eighths: number, note: number): number {
  const now = Math.floor(eighths);
  for (let back = 0; back < CHORD_EIGHTHS && back <= now; back += 1) {
    if (arpStepAt(now - back) === note) {
      const age = eighths - (now - back);
      return Math.min(1, age / STRIKE_EIGHTHS) * Math.exp(-age / FADE_EIGHTHS);
    }
  }
  return 0;
}

// Where the title began to follow the ambience: a position earlier than that is a new ambience.
export function heardFrom(origin: number | null, eighths: number): number {
  return origin === null || eighths < origin ? eighths : origin;
}

// What the title shows `eighths` into the menu ambience, having heard it for `heardFor` eighths.
export function titleLightAt(eighths: number, heardFor = Infinity): TitleLight {
  const inChord = eighths % CHORD_EIGHTHS;
  const awake = ease(Math.min(1, Math.max(0, heardFor) / WAKE_EIGHTHS));
  return {
    swell: TITLE_AT_REST.swell + (swellAt(eighths) - TITLE_AT_REST.swell) * awake,
    sheen: inChord < SHEEN_EIGHTHS ? inChord / SHEEN_EIGHTHS : 0,
    reflections: TITLE_AT_REST.reflections.map((_, note) => reflectionAt(eighths, note)),
  };
}

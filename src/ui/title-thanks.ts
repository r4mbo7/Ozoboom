import { CREDITS, type Credits } from '../data/credits';
import { t } from '../shared/i18n';
import { DEFAULT_BPM } from '../shared/tempo';

export interface Thanks {
  readonly label: string;
  readonly name: string;
}

export interface ThanksShown {
  readonly thanks: Thanks;
  // Left of the menu first, then right, in turn.
  readonly side: 'left' | 'right';
  // Which 4 bars of the ambience it lives in, and how far into them, in eighths.
  readonly slot: number;
  readonly at: number;
}

export interface ThanksClock {
  // Each frame on the title, with the ambience position in eighths. Nothing interrupts them.
  at(position: number): ThanksShown | null;
}

// An eighth of the menu ambience lasts a beat of the set: 20 s on the title, then a name every 4 bars.
export const WAIT_EIGHTHS = (20 * DEFAULT_BPM) / 60;
export const SLOT_EIGHTHS = 32;
// A frame lasts a fraction of an eighth: a longer leap is another clock, the audio's or its silent
// stand-in, which the wait carries over.
const LEAP_EIGHTHS = 4;

export function thanksOf(credits: Credits = CREDITS): Thanks[] {
  return [
    { label: t('Music'), name: credits.music.name },
    ...credits.thanks.map(({ name }) => ({ label: t('Thanks to'), name })),
  ];
}

export function createThanksClock(thanks: readonly Thanks[]): ThanksClock {
  let waitFrom: number | null = null;
  let last: number | null = null;

  return {
    at(position) {
      if (waitFrom === null || last === null) {
        waitFrom = position;
      } else if (Math.abs(position - last) > LEAP_EIGHTHS) {
        waitFrom += position - last;
      }
      last = position;
      const first = Math.ceil((waitFrom + WAIT_EIGHTHS) / SLOT_EIGHTHS);
      const slot = Math.floor(position / SLOT_EIGHTHS);
      const passed = slot - first;
      const shown = thanks[passed % thanks.length];
      if (passed < 0 || shown === undefined) {
        return null;
      }
      return {
        thanks: shown,
        side: passed % 2 === 0 ? 'left' : 'right',
        slot,
        at: position - slot * SLOT_EIGHTHS,
      };
    },
  };
}

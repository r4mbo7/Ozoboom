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
  // Each frame on the title, with the ambience position in eighths.
  at(position: number): ThanksShown | null;
  // Any input erases the thanks and starts the wait again.
  wake(): void;
}

// An eighth of the menu ambience lasts a beat of the set: 20 s without a touch, then a name every 4 bars.
export const IDLE_EIGHTHS = (20 * DEFAULT_BPM) / 60;
export const SLOT_EIGHTHS = 32;
// A frame lasts a fraction of an eighth: a longer leap is another clock, the audio's or its silent
// stand-in, which the wait carries over.
const LEAP_EIGHTHS = 4;

export function thanksOf(credits: Credits = CREDITS): Thanks[] {
  return [
    { label: t('Musique'), name: credits.music.name },
    ...credits.thanks.map(({ name }) => ({ label: t('Merci à'), name })),
  ];
}

export function createThanksClock(thanks: readonly Thanks[]): ThanksClock {
  let idleFrom: number | null = null;
  let last: number | null = null;
  let next = 0;
  let begun = 0;

  return {
    at(position) {
      if (idleFrom === null || last === null) {
        idleFrom = position;
      } else if (Math.abs(position - last) > LEAP_EIGHTHS) {
        idleFrom += position - last;
      }
      last = position;
      const first = Math.ceil((idleFrom + IDLE_EIGHTHS) / SLOT_EIGHTHS);
      const slot = Math.floor(position / SLOT_EIGHTHS);
      const passed = slot - first;
      const shown = thanks[(next + passed) % thanks.length];
      if (passed < 0 || shown === undefined) {
        return null;
      }
      begun = passed + 1;
      return {
        thanks: shown,
        side: passed % 2 === 0 ? 'left' : 'right',
        slot,
        at: position - slot * SLOT_EIGHTHS,
      };
    },
    wake() {
      next = (next + begun) % Math.max(thanks.length, 1);
      begun = 0;
      idleFrom = null;
      last = null;
    },
  };
}

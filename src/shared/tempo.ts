export const DEFAULT_BPM = 145;
export const BEATS_PER_BAR = 4;
export const BARS_PER_PHRASE = 16;
export const TICKS_PER_BEAT = 12;
export const TICKS_PER_BAR = TICKS_PER_BEAT * BEATS_PER_BAR;
export const TICKS_PER_PHRASE = TICKS_PER_BAR * BARS_PER_PHRASE;
export const TICK_RATE_HZ = (DEFAULT_BPM * TICKS_PER_BEAT) / 60;
export const TICK_MS = 1000 / TICK_RATE_HZ;

export function beatPeriodMs(bpm: number): number {
  if (!(bpm > 0)) {
    throw new RangeError(`bpm must be positive, got ${String(bpm)}`);
  }
  return 60_000 / bpm;
}

export function beatOfTick(tick: number): number {
  return Math.floor(tick / TICKS_PER_BEAT);
}

export function barOfTick(tick: number): number {
  return Math.floor(tick / TICKS_PER_BAR);
}

export function phraseOfTick(tick: number): number {
  return Math.floor(tick / TICKS_PER_PHRASE);
}

export function isBeatTick(tick: number): boolean {
  return tick % TICKS_PER_BEAT === 0;
}

export function isBarTick(tick: number): boolean {
  return tick % TICKS_PER_BAR === 0;
}

export const DEFAULT_BPM = 145;
export const BEATS_PER_BAR = 4;
export const BARS_PER_PHRASE = 16;
export const TICKS_PER_BEAT = 12;
export const TICKS_PER_BAR = TICKS_PER_BEAT * BEATS_PER_BAR;
export const TICKS_PER_PHRASE = TICKS_PER_BAR * BARS_PER_PHRASE;
export const TICK_RATE_HZ = (DEFAULT_BPM * TICKS_PER_BEAT) / 60;
export const TICK_MS = 1000 / TICK_RATE_HZ;

// A stage's tempo: the tick stays at TICK_RATE_HZ, only the beat length in ticks changes (ADR 0012). Its beats,
// bars and phrases count from `originTick`, the tick its set started at (ADR 0018).
export interface Tempo {
  readonly ticksPerBeat: number;
  readonly ticksPerBar: number;
  readonly ticksPerPhrase: number;
  readonly bpm: number;
  readonly originTick: number;
}

export function tempoOf(ticksPerBeat: number, originTick = 0): Tempo {
  if (!Number.isInteger(ticksPerBeat) || ticksPerBeat <= 0) {
    throw new RangeError(`ticksPerBeat must be a positive integer, got ${String(ticksPerBeat)}`);
  }
  if (!Number.isInteger(originTick) || originTick < 0) {
    throw new RangeError(`originTick must be a whole tick, got ${String(originTick)}`);
  }
  const ticksPerBar = ticksPerBeat * BEATS_PER_BAR;
  return {
    ticksPerBeat,
    ticksPerBar,
    ticksPerPhrase: ticksPerBar * BARS_PER_PHRASE,
    bpm: (TICK_RATE_HZ * 60) / ticksPerBeat,
    originTick,
  };
}

export const MAIN_TEMPO: Tempo = tempoOf(TICKS_PER_BEAT);

export function beatPeriodMs(bpm: number): number {
  if (!(bpm > 0)) {
    throw new RangeError(`bpm must be positive, got ${String(bpm)}`);
  }
  return 60_000 / bpm;
}

export function beatOfTick(tick: number, tempo: Tempo = MAIN_TEMPO): number {
  return Math.floor((tick - tempo.originTick) / tempo.ticksPerBeat);
}

export function barOfTick(tick: number, tempo: Tempo = MAIN_TEMPO): number {
  return Math.floor((tick - tempo.originTick) / tempo.ticksPerBar);
}

export function phraseOfTick(tick: number, tempo: Tempo = MAIN_TEMPO): number {
  return Math.floor((tick - tempo.originTick) / tempo.ticksPerPhrase);
}

// Ticks since the last beat, in [0, ticksPerBeat), for a tick or a time between two ticks.
export function ticksIntoBeat(tick: number, tempo: Tempo = MAIN_TEMPO): number {
  return within(tick - tempo.originTick, tempo.ticksPerBeat);
}

export function ticksIntoBar(tick: number, tempo: Tempo = MAIN_TEMPO): number {
  return within(tick - tempo.originTick, tempo.ticksPerBar);
}

export function ticksIntoPhrase(tick: number, tempo: Tempo = MAIN_TEMPO): number {
  return within(tick - tempo.originTick, tempo.ticksPerPhrase);
}

export function isBeatTick(tick: number, tempo: Tempo = MAIN_TEMPO): boolean {
  return ticksIntoBeat(tick, tempo) === 0;
}

// Halfway through the beat, rounded down when a beat has an odd number of ticks.
export function isOffbeatTick(tick: number, tempo: Tempo = MAIN_TEMPO): boolean {
  return ticksIntoBeat(tick, tempo) === Math.floor(tempo.ticksPerBeat / 2);
}

export function isBarTick(tick: number, tempo: Tempo = MAIN_TEMPO): boolean {
  return ticksIntoBar(tick, tempo) === 0;
}

export function isPhraseTick(tick: number, tempo: Tempo = MAIN_TEMPO): boolean {
  return ticksIntoPhrase(tick, tempo) === 0;
}

function within(ticks: number, period: number): number {
  const into = ticks % period;
  return into < 0 ? into + period : into;
}

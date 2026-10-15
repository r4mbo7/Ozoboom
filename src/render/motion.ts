import { MAIN_TEMPO, TICK_RATE_HZ, TICKS_PER_BEAT, type Tempo } from '../shared/tempo';

export const MAX_FLASHES_PER_SECOND = 3;
export const MIN_TICKS_BETWEEN_FLASHES = Math.ceil(TICK_RATE_HZ / MAX_FLASHES_PER_SECOND);

export function lerp(previous: number, current: number, alpha: number): number {
  return previous + (current - previous) * alpha;
}

export function beatEnvelope(ticksSinceBeat: number, tempo: Tempo = MAIN_TEMPO): number {
  const decay = tempo.ticksPerBar / 2;
  if (ticksSinceBeat < 0 || ticksSinceBeat >= decay) {
    return 0;
  }
  const remaining = 1 - ticksSinceBeat / decay;
  return remaining * remaining;
}

export class FlashLimiter {
  private lastStart = Number.NEGATIVE_INFINITY;

  tryStart(tick: number): boolean {
    if (tick - this.lastStart < MIN_TICKS_BETWEEN_FLASHES) {
      return false;
    }
    this.lastStart = tick;
    return true;
  }
}

export const BLINK_TICKS = 2 * TICKS_PER_BEAT;

// A taunted bad vibe is lit half of each beat: 2.4 flashes per second, under the budget of three.
// The calm mode never blinks, it holds the highlight.
export function blinkLit(now: number, untilTick: number, calm: boolean): boolean {
  if (now >= untilTick) {
    return false;
  }
  return calm || Math.floor(now / (TICKS_PER_BEAT / 2)) % 2 === 0;
}

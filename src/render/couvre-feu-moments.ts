import { BEATS_PER_BAR } from '../shared/tempo';

// The Couvre-feu's own moments, in beats and boss radii. Pure timing: `couvre-feu.ts` draws them.

const TAU = Math.PI * 2;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const ease = (p: number) => p * p * (3 - 2 * p);

// His torch sweeps the floor ahead of him, there and back over 8 bars, twice slower in calm mode.
export const TORCH = {
  swing: 0.42,
  bars: 8,
  calmBars: 16,
  // Half the opening of its cone, and how far it reaches, in boss radii.
  half: 0.2,
  reach: 6.6,
  // The cone's soft edge, as an angle, and its soft end, as a share of its reach.
  edge: 0.04,
  end: 0.15,
} as const;

// The torch's turn away from straight ahead, `beats` after he landed: it starts straight ahead.
export function torchSweep(beats: number, calm: boolean): number {
  const period = (calm ? TORCH.calmBars : TORCH.bars) * BEATS_PER_BAR;
  return TORCH.swing * Math.sin((beats / period) * TAU);
}

// How much the torch aimed at `aim` lights what stands at (dx, dy) from him: 1 inside its cone,
// 0 outside, soft over its edges.
export function torchLight(dx: number, dy: number, aim: number, reach: number): number {
  const distance = Math.hypot(dx, dy);
  if (distance >= reach) {
    return 0;
  }
  const off = Math.abs(((((Math.atan2(dy, dx) - aim) % TAU) + 3 * Math.PI) % TAU) - Math.PI);
  return (
    clamp01((TORCH.half - off) / TORCH.edge) * clamp01((reach - distance) / (TORCH.end * reach))
  );
}

// On the one of every bar he blows his whistle: waves leave it one after the other, three of them,
// one in calm mode.
export const WHISTLE_WAVES = { normal: 3, calm: 1 } as const;
const WAVE_SPEED = 1.2;
const WAVE_STAGGER = 0.15;

// How far wave `index` has gone, from 0 to 1, `beats` into the bar; null when it is not out.
export function whistleWave(beats: number, index: number): number | null {
  const into = ((beats % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR;
  const progress = into * WAVE_SPEED - index * WAVE_STAGGER;
  return progress > 0 && progress < 1 ? progress : null;
}

export interface Flight {
  // From where it was, in boss radii, `side` being where it flies to: -1 left, 1 right.
  readonly dx: number;
  readonly dy: number;
  readonly turn: number;
  readonly alpha: number;
}

// Chased, his cap flies off backward, turning, while his badge rises as a small golden sun. Both
// play over `beats` from the burst, `length` long.
export function capFlight(beats: number, length: number, side: number): Flight {
  const p = clamp01(beats / length);
  return {
    dx: side * 1.84 * p,
    dy: -1.58 * Math.sin(Math.PI * p) - 0.53 * p + 2.37 * p * p,
    turn: side * 7 * p,
    alpha: clamp01(1 - p / 0.9),
  };
}

export function sunRise(beats: number, length: number): Flight {
  const p = clamp01(beats / length);
  const rise = clamp01((p - 0.15) / 0.6);
  return {
    dx: 0,
    dy: -1.32 - 1.05 * ease(rise),
    turn: 2 * p,
    alpha: clamp01(rise * 3) * clamp01((1 - p) * 5),
  };
}

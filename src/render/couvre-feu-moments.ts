import { clamp01, smoothstep } from '../shared/scalar';
import { BEATS_PER_BAR } from '../shared/tempo';

const TAU = Math.PI * 2;

export const TORCH = {
  swing: 0.42,
  bars: 8,
  calmBars: 16,
  half: 0.2,
  reach: 6.6,
  edge: 0.04,
  end: 0.15,
} as const;

export function torchSweep(beats: number, calm: boolean): number {
  const period = (calm ? TORCH.calmBars : TORCH.bars) * BEATS_PER_BAR;
  return TORCH.swing * Math.sin((beats / period) * TAU);
}

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

export const WHISTLE_WAVES = { normal: 3, calm: 1 } as const;
const WAVE_SPEED = 1.2;
const WAVE_STAGGER = 0.15;

export function whistleWave(beats: number, index: number): number | null {
  const into = ((beats % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR;
  const progress = into * WAVE_SPEED - index * WAVE_STAGGER;
  return progress > 0 && progress < 1 ? progress : null;
}

export interface Flight {
  readonly dx: number;
  readonly dy: number;
  readonly turn: number;
  readonly alpha: number;
}

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
    dy: -1.32 - 1.05 * smoothstep(rise),
    turn: 2 * p,
    alpha: clamp01(rise * 3) * clamp01((1 - p) * 5),
  };
}

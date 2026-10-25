import { clamp01, frac } from '../shared/scalar';
import { BEATS_PER_BAR } from '../shared/tempo';

const TAU = Math.PI * 2;

export type Point = readonly [number, number];

export const GAUGE = {
  cells: 4,
  y: -15,
  firstX: -17.25,
  step: 11.5,
  width: 9.5,
  height: 10,
  fillBars: 2,
  blinkBeats: 2,
  blinkLow: 0.3,
} as const;

export function cellsLit(chargeBeats: number): number {
  return Math.min(GAUGE.cells, 1 + Math.floor(chargeBeats / (GAUGE.fillBars * BEATS_PER_BAR)));
}

export function cellGlow(index: number, lit: number, beats: number, calm: boolean): number {
  if (index >= lit) {
    return 0;
  }
  if (lit > 1 || calm) {
    return 1;
  }
  const wave = 0.5 + 0.5 * Math.cos((beats / GAUGE.blinkBeats) * TAU);
  return GAUGE.blinkLow + (1 - GAUGE.blinkLow) * wave;
}

export const SOCKETS: readonly Point[] = [
  [-14, 40],
  [0, 40],
  [14, 40],
];
export const REACH = 6;
const KEEP = 1.25;
export const PLUG_BEATS = 1;

export interface Target {
  readonly key: string;
  readonly x: number;
  readonly y: number;
}

export function assignCables(
  boss: Point,
  reach: number,
  targets: readonly Target[],
  current: readonly (string | null)[],
): (string | null)[] {
  const distance = (target: Target) => Math.hypot(target.x - boss[0], target.y - boss[1]);
  const byKey = new Map(targets.map((target) => [target.key, target]));
  const kept = current.map((key) => {
    const target = key === null ? undefined : byKey.get(key);
    return target !== undefined && distance(target) <= reach * KEEP ? key : null;
  });
  const free = targets
    .filter((target) => distance(target) <= reach && !kept.includes(target.key))
    .sort((a, b) => distance(a) - distance(b));
  return kept.map((key) => key ?? free.shift()?.key ?? null);
}

export type CablePath = readonly [number, number, number, number, number, number];

export function cablePath(
  from: Point,
  to: Point,
  index: number,
  beats: number,
  unit: number,
): CablePath {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const cx = (x0 + x1) / 2 + Math.sin(beats * 0.8 + index) * 10 * unit;
  const cy = Math.max(y0, y1) + (30 + index * 8) * unit;
  return [x0, y0, cx, cy, x1, y1];
}

export function alongCable([x0, y0, cx, cy, x1, y1]: CablePath, p: number): Point {
  const q = 1 - p;
  return [q * q * x0 + 2 * q * p * cx + p * p * x1, q * q * y0 + 2 * q * p * cy + p * p * y1];
}

export function cableReach(beats: number, leaving: boolean): number {
  return leaving ? clamp01(1 - beats / PLUG_BEATS) : clamp01(beats / PLUG_BEATS);
}

export const PEARLS = 4;
const PEARL_BEATS = 2;

export function pearlAt(beats: number, index: number, cable: number, giving: boolean): number {
  const p = frac(beats / PEARL_BEATS + index / PEARLS + cable * 0.13);
  return giving ? p : 1 - p;
}

export interface Fade {
  readonly from: number;
  readonly to: number;
  readonly mix: number;
}

export function teamCell(index: number, beats: number, count: number, calm: boolean): Fade {
  const at = beats * 2 + index;
  const step = Math.floor(at);
  return { from: step % count, to: (step + 1) % count, mix: calm ? 0 : at - step };
}

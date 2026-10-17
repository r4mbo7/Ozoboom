import { BEATS_PER_BAR } from '../shared/tempo';

// The Batterie à plat's own moments, in beats and mask units. Pure timing: `batterie.ts` draws them.

const TAU = Math.PI * 2;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const frac = (value: number) => value - Math.floor(value);

export type Point = readonly [number, number];

// Her gauge: four cells across the slot of her mask, one more lit every `fillBars` bars she stays
// plugged into something that shines, until full. Alone, the lit cell blinks softly on a half note.
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

// How bright cell `index` is while `lit` cells are: out past them, blinking when it is the only one.
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

// Three cables leave the sockets under her base and plug into what shines within `REACH` boss radii,
// reaching it over `PLUG_BEATS`; a plugged one holds on as far as `KEEP` times that.
export const SOCKETS: readonly Point[] = [
  [-14, 40],
  [0, 40],
  [14, 40],
];
export const REACH = 6;
export const KEEP = 1.25;
export const PLUG_BEATS = 1;

export interface Target {
  readonly key: string;
  readonly x: number;
  readonly y: number;
}

// Which target each socket's cable plugs into: a cable keeps its target while it stays near enough,
// a free one takes the nearest target no cable holds. null for a cable with nothing to plug.
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

// A cable from a socket to its target, hanging on the floor between them: a quadratic curve whose
// middle sways with the beat and sags below both ends, more for each cable. `unit` is a mask unit
// in world pixels.
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

// How far a cable has gone toward its target `beats` after it set out, or come back `beats` after
// it let go.
export function cableReach(beats: number, leaving: boolean): number {
  return leaving ? clamp01(1 - beats / PLUG_BEATS) : clamp01(beats / PLUG_BEATS);
}

// Four pearls ride each cable, two beats from end to end, spread along it and from one cable to the
// next: drained toward the socket, given back toward the target when she is chased.
export const PEARLS = 4;
const PEARL_BEATS = 2;

// Where pearl `index` of cable `cable` is, from the socket (0) to the target (1).
export function pearlAt(beats: number, index: number, cable: number, giving: boolean): number {
  const p = frac(beats / PEARL_BEATS + index / PEARLS + cable * 0.13);
  return giving ? p : 1 - p;
}

// Chased, her gauge fades through the team's colors, two steps a beat, each cell one step ahead of
// the last; in calm mode it changes cell by cell, without the fade.
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

import { clamp01, smoothstep } from '../shared/scalar';
import { CROSS_STEPS } from './textures-raver';

// In beats unless named otherwise.
// Each vibe of the reward leaves on a sixteenth and lands one beat later.
export const VIBE_GAP_BEATS = 0.25;
export const VIBE_FLIGHT_BEATS = 1;

// The way each square of the cross flies, and its spin: top, right, bottom, left, middle.
export const SHARDS = [
  [0.2, -1, 1.6],
  [1, -0.3, -2.2],
  [-0.3, 0.6, 2.4],
  [-1, -0.4, -1.8],
  [0.1, 0.1, 0.9],
] as const;
// Where each mote leaves from around the face, and how high it rises.
export const MOTE_PATHS = [
  [-12, -6, 30],
  [8, 9, 38],
  [-3, -13, 27],
  [14, -4, 34],
  [-15, 7, 41],
  [4, -2, 32],
  [11, 12, 29],
  [-8, 13, 36],
  [0, 4, 40],
] as const;

// Where `value` stands between `from` and `to`, held in [0, 1].
export function within(value: number, from: number, to: number): number {
  return clamp01((value - from) / (to - from));
}

export function smoothWithin(value: number, from: number, to: number): number {
  return smoothstep(within(value, from, to));
}

// One bead per bar of its lifetime, lit while that bar is still ahead.
export function beadsLit(ticksLeft: number, ticksPerBar: number, beads: number): number {
  return Math.max(0, Math.min(beads, Math.ceil(ticksLeft / ticksPerBar)));
}

export function crossStep(ticksLeft: number, lifetimeTicks: number): number {
  if (!(lifetimeTicks > 0)) {
    return CROSS_STEPS;
  }
  return Math.ceil(clamp01(ticksLeft / lifetimeTicks) * CROSS_STEPS);
}

// How far the reward's vibe `index` is on its flight, `beats` after the help: null before it
// leaves and once it has landed.
export function vibeFlight(index: number, beats: number): number | null {
  const share = (beats - index * VIBE_GAP_BEATS) / VIBE_FLIGHT_BEATS;
  return share < 0 || share >= 1 ? null : share;
}

export function rewardBeats(count: number): number {
  return (count - 1) * VIBE_GAP_BEATS + VIBE_FLIGHT_BEATS;
}

interface Point {
  x: number;
  y: number;
}

export function flightPoint(
  from: Point,
  to: Point,
  index: number,
  share: number,
  out: Point,
): void {
  const side = to.x >= from.x ? 1 : -1;
  const eased = smoothstep(share * 0.5 + 0.5) * 2 - 1;
  const rest = 1 - eased;
  const a = rest * rest * rest;
  const b = 3 * rest * rest * eased;
  const c = 3 * rest * eased * eased;
  const d = eased * eased * eased;
  out.x =
    a * (from.x + side * 10) +
    b * (from.x + side * 22) +
    c * (to.x + side * (78 + (index % 3) * 6)) +
    d * to.x;
  out.y = a * (from.y - 14) + b * (from.y - 64) + c * (to.y - 36 + (index % 2) * 8) + d * to.y;
}

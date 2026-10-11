import type { SunMoment } from '../shared/palette';
import { nextFloat, seedRng } from '../shared/prng';
import type { Tempo } from '../shared/tempo';
import { SCALE } from './ambyss-layout';
import type { Vec2 } from '../shared/vec';

export const GROW_TICKS = 5;
const SECOND_TRAIL_CHANCE = 0.4;
// Where trails start, around the core: mostly in the east sky.
const ORIGIN = { west: -300, east: 800, north: -530, south: 110 };
const LENGTH = { min: 260, spread: 520 };
const HEADING = { angle: Math.PI * 0.8, spread: 0.28 };
const HUE = { min: 170, spread: 120 };
const CURLS = [
  { at: 0.3, spread: 0.2 },
  { at: 0.65, spread: 0.2 },
];
const CURL_RADIUS = { min: 4, spread: 8 };

export const VEIL_COUNT = 6;
export const VEIL_ANGLE = -Math.PI * 0.2;
export const VEIL_LENGTH = 1800 * SCALE;
const VEIL_TRAVEL = 1000;

export interface Curl {
  readonly at: number;
  readonly radius: number;
  readonly side: 1 | -1;
}

export interface Trail {
  readonly born: number;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly hue: number;
  readonly curls: readonly Curl[];
}

export interface Veil {
  // Along the slide, from the core, before the turn by VEIL_ANGLE.
  readonly offset: number;
  readonly halfWidth: number;
  readonly tone: 0 | 1;
}

// The veils take turns: tone 0, then tone 1.
export interface VeilLook {
  readonly tone0: string;
  readonly tone1: string;
  readonly alpha: number;
}

export const VEIL_LOOKS: Record<SunMoment, VeilLook> = {
  crepuscule: { tone0: '#ffa078', tone1: '#9b6bff', alpha: 0.12 },
  nuit: { tone0: '#9b6bff', tone1: '#3fd0c9', alpha: 0.13 },
  aube: { tone0: '#ffc878', tone1: '#ffaa96', alpha: 0.22 },
  jour: { tone0: '#ffe2a0', tone1: '#fff0c8', alpha: 0.16 },
};

function trailsOfBeat(seed: number, beat: number, tempo: Tempo, center: Vec2): Trail[] {
  const rng = seedRng((seed ^ Math.imul(beat + 1, 0x9e3779b1)) >>> 0);
  const between = (min: number, spread: number) => min + nextFloat(rng) * spread;
  const count = nextFloat(rng) < SECOND_TRAIL_CHANCE ? 2 : 1;
  return Array.from({ length: count }, () => {
    const angle = between(HEADING.angle - HEADING.spread / 2, HEADING.spread);
    const length = between(LENGTH.min, LENGTH.spread) * SCALE;
    const x0 = center.x + between(ORIGIN.west, ORIGIN.east - ORIGIN.west) * SCALE;
    const y0 = center.y + between(ORIGIN.north, ORIGIN.south - ORIGIN.north) * SCALE;
    return {
      born: beat * tempo.ticksPerBeat,
      x0,
      y0,
      x1: x0 + length * Math.cos(angle),
      y1: y0 + length * Math.sin(angle),
      hue: between(HUE.min, HUE.spread),
      curls: CURLS.map(({ at, spread }): Curl => ({
        at: between(at, spread),
        radius: between(CURL_RADIUS.min, CURL_RADIUS.spread) * SCALE,
        side: nextFloat(rng) < 0.5 ? 1 : -1,
      })),
    };
  });
}

// The trails alive at `now`: each beat lets one or two loose, and each fades out within a bar.
export function trailsAt(seed: number, now: number, tempo: Tempo, center: Vec2): Trail[] {
  const { ticksPerBeat, ticksPerBar } = tempo;
  const trails: Trail[] = [];
  const first = Math.max(0, Math.floor((now - ticksPerBar) / ticksPerBeat) + 1);
  for (let beat = first; beat * ticksPerBeat <= now; beat += 1) {
    trails.push(...trailsOfBeat(seed, beat, tempo, center));
  }
  return trails;
}

// How far a trail has drawn itself, and how much of its light is left.
export function trailGlow(trail: Trail, now: number, tempo: Tempo): { grow: number; fade: number } {
  const age = now - trail.born;
  if (age < GROW_TICKS) {
    return { grow: Math.max(0, age / GROW_TICKS), fade: 1 };
  }
  const left = Math.max(0, 1 - (age - GROW_TICKS) / (tempo.ticksPerBar - GROW_TICKS));
  return { grow: 1, fade: left * left * left };
}

export function veilsAt(now: number, tempo: Tempo, calm: boolean): Veil[] {
  const phrase = tempo.ticksPerPhrase;
  const slide = calm ? 0 : now;
  return Array.from({ length: VEIL_COUNT }, (_, index) => {
    const phase = ((slide + (index * phrase) / VEIL_COUNT) % phrase) / phrase;
    return {
      offset: (-VEIL_TRAVEL + phase * 2 * VEIL_TRAVEL) * SCALE,
      halfWidth: (70 + ((index * 53) % 90)) * SCALE,
      tone: (index % 2) as 0 | 1,
    };
  });
}

// hue in degrees, saturation and lightness in [0, 1].
export function hsl(hue: number, saturation: number, lightness: number): number {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const channel = (n: number): number => {
    const k = (n + hue / 30) % 12;
    const value = lightness - (chroma / 2) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255);
  };
  return (channel(0) << 16) | (channel(8) << 8) | channel(4);
}

import { DAWN_AT, NIGHT_END, NIGHT_START } from '../shared/palette';
import { clamp01, smoothstep } from '../shared/scalar';

export interface Shadow {
  // In radians, screen space, y down.
  angle: number;
  // In crown radii; zero at night.
  length: number;
  alpha: number;
}

export const MAX_FIREFLIES = 40;
const CALM_FIREFLIES = 12;
const FIREFLIES_FROM = 0.05;
const FIREFLIES_OUT = 0.8;

const DUSK_ANGLE = 0.35;
const DAWN_ANGLE = Math.PI - 0.35;
const NOON_ANGLE = Math.PI * 1.5;
const LONG = 2.6;
const SHORT = 0.5;
const MAX_ALPHA = 0.34;

function smooth(from: number, to: number, value: number): number {
  return smoothstep(clamp01((value - from) / (to - from)));
}

function sunStrength(fraction: number): number {
  return fraction < NIGHT_START
    ? 1 - smooth(0, NIGHT_START, fraction)
    : smooth(NIGHT_END, DAWN_AT, fraction);
}

export function shadowAt(fraction: number): Shadow {
  const strength = sunStrength(fraction);
  if (fraction < NIGHT_START) {
    return { angle: DUSK_ANGLE, length: LONG * strength, alpha: MAX_ALPHA * strength };
  }
  const climb = smooth(DAWN_AT, 1, fraction);
  return {
    angle: DAWN_ANGLE + (NOON_ANGLE - DAWN_ANGLE) * climb,
    length: (LONG + (SHORT - LONG) * climb) * strength,
    alpha: MAX_ALPHA * strength,
  };
}

export function fireflyLevel(fraction: number): number {
  return (
    smooth(FIREFLIES_FROM, NIGHT_START, fraction) * (1 - smooth(NIGHT_END, FIREFLIES_OUT, fraction))
  );
}

export function firefliesAt(fraction: number, calm: boolean): number {
  const most = calm ? CALM_FIREFLIES : MAX_FIREFLIES;
  return Math.ceil(most * fireflyLevel(fraction));
}

function luminance(color: number): number {
  const linear = (shift: number): number => {
    const value = ((color >> shift) & 0xff) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(16) + 0.7152 * linear(8) + 0.0722 * linear(0);
}

export function contrast(a: number, b: number): number {
  const [first, second] = [luminance(a), luminance(b)];
  const light = Math.max(first, second);
  const dark = Math.min(first, second);
  return (light + 0.05) / (dark + 0.05);
}

export function darker(a: number, b: number): number {
  return luminance(a) <= luminance(b) ? a : b;
}

import { clamp01, frac, lerp, smoothstep } from '../shared/scalar';
import { hash } from './hash';

const TAU = Math.PI * 2;

export const MOCKUP_SCALE = 1.3;

export interface GustTimes {
  readonly x: number;
  readonly y: number;
  readonly warnTick: number;
  readonly blowTick: number;
  readonly endTick: number;
}

export interface GustPhase {
  readonly kind: 'warn' | 'blow' | 'settle';
  readonly progress: number;
  readonly x: number;
  readonly y: number;
}

const SETTLE_BEATS = 4;

export function gustPhase(
  gust: GustTimes | undefined,
  now: number,
  ticksPerBeat: number,
): GustPhase | undefined {
  if (gust === undefined || now < gust.warnTick) {
    return undefined;
  }
  const { x, y, warnTick, blowTick, endTick } = gust;
  if (now < blowTick) {
    return { kind: 'warn', progress: (now - warnTick) / (blowTick - warnTick), x, y };
  }
  if (now < endTick) {
    return { kind: 'blow', progress: (now - blowTick) / (endTick - blowTick), x, y };
  }
  const settle = (now - endTick) / (SETTLE_BEATS * ticksPerBeat);
  return settle < 1 ? { kind: 'settle', progress: settle, x, y } : undefined;
}

export interface Mane {
  readonly angle: number;
  readonly fullness: number;
  readonly rate: number;
}

const MANE = {
  restAngle: Math.PI * 0.82,
  restFullness: 0.45,
  restRate: 2.4,
  warnFullness: 0.85,
  warnRate: 5,
  blowRate: 11,
  calmRate: 1.2,
};

function nearestTurn(from: number, to: number): number {
  let turn = to - from;
  while (turn > Math.PI) {
    turn -= TAU;
  }
  while (turn < -Math.PI) {
    turn += TAU;
  }
  return from + turn;
}

export function mane(phase: GustPhase | undefined, beats: number, calm: boolean): Mane {
  const rest: Mane = {
    angle: MANE.restAngle + (calm ? 0 : 0.2 * Math.sin(beats * 0.5)),
    fullness: MANE.restFullness + (calm ? 0 : 0.06 * Math.sin(beats * 0.7)),
    rate: calm ? MANE.calmRate : MANE.restRate,
  };
  if (phase === undefined) {
    return rest;
  }
  const downwind = nearestTurn(rest.angle, Math.atan2(phase.y, phase.x));
  const fast = calm ? MANE.calmRate : MANE.blowRate;
  if (phase.kind === 'warn') {
    const p = smoothstep(phase.progress);
    return {
      angle: lerp(rest.angle, downwind, p),
      fullness: lerp(rest.fullness, MANE.warnFullness, p),
      rate: lerp(rest.rate, calm ? MANE.calmRate : MANE.warnRate, p),
    };
  }
  if (phase.kind === 'blow') {
    return { angle: downwind + (calm ? 0 : 0.06 * Math.sin(beats * 6)), fullness: 1, rate: fast };
  }
  const p = smoothstep(phase.progress);
  return {
    angle: lerp(downwind, rest.angle, p),
    fullness: lerp(1, rest.fullness, p),
    rate: lerp(fast, rest.rate, p),
  };
}

// Drawn in this order, the outer ribbons behind.
export const RIBBONS: readonly number[] = [-0.6, 0.6, -0.36, 0.36, -0.12, 0.12];

export interface RibbonStart {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly length: number;
  readonly amp: number;
  readonly width: number;
}

export function ribbonStart(spread: number, state: Mane): RibbonStart {
  const { angle, fullness } = state;
  return {
    x: Math.cos(angle + spread * 2) * 16 * MOCKUP_SCALE,
    y: Math.sin(angle + spread * 2) * 18 * MOCKUP_SCALE,
    angle: angle + spread * (0.75 - fullness * 0.35),
    length: (62 - Math.abs(spread) * 30) * (0.7 + 0.5 * fullness) * MOCKUP_SCALE,
    amp: 0.5 - fullness * 0.3,
    width: (12.5 - Math.abs(spread) * 5) * MOCKUP_SCALE,
  };
}

export function ribbonIndex(spread: number): number {
  return Math.round((spread + 0.6) / 0.24);
}

export function maneWave(phase: number, index: number, amp: number): (u: number) => number {
  return (u) => Math.sin(phase - u * 3.2 + index * 0.35) * amp * u;
}

// Advanced step by step: an absolute time times a changing rate would leap at each change of rate.
export function wavePhase(phase: number, beatsSince: number, rate: number): number {
  return phase + clamp01(beatsSince) * rate * 0.5;
}

export interface RibbonPoint {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly width: number;
  readonly nx: number;
  readonly ny: number;
}

// Few points: the ribbons are rebuilt every image.
const RIBBON_STEPS = { along: 14, curl: 10 };

function ribbonPoint(x: number, y: number, angle: number, width: number): RibbonPoint {
  return { x, y, angle, width, nx: -Math.sin(angle), ny: Math.cos(angle) };
}

export function ribbonPoints(
  start: {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
    readonly length: number;
    readonly width: number;
  },
  wave: (u: number) => number,
  turns = 1.15,
): RibbonPoint[] {
  const points: RibbonPoint[] = [];
  const steps = RIBBON_STEPS.along;
  const curls = RIBBON_STEPS.curl;
  let { x, y, angle } = start;
  for (let step = 0; step <= steps; step += 1) {
    const u = step / steps;
    points.push(ribbonPoint(x, y, angle, lerp(start.width, start.width * 0.55, u)));
    angle = start.angle + wave(u);
    x += (Math.cos(angle) * start.length) / steps;
    y += (Math.sin(angle) * start.length) / steps;
  }
  for (let curl = 1; curl <= curls; curl += 1) {
    const s = curl / curls;
    angle -= ((turns * TAU) / curls) * (1 - s * 0.35);
    const stride = (start.length / steps) * 0.9 * (1 - s * 0.8);
    x += Math.cos(angle) * stride;
    y += Math.sin(angle) * stride;
    points.push(ribbonPoint(x, y, angle, start.width * 0.55 * (1 - s * 0.8)));
  }
  return points;
}

export const CHEVRONS = { rows: 3, gap: 9, creep: 4, step: 76, sideStep: 38, inset: 30 };

export function chevronRow(
  row: number,
  beats: number,
  calm: boolean,
): { offset: number; alpha: number } {
  const creep = calm ? 0 : frac(beats - row * 0.25) * CHEVRONS.creep;
  const pulse = calm ? 0.6 : 0.35 + 0.65 * Math.exp(-frac(beats) * 5);
  return { offset: row * CHEVRONS.gap + creep, alpha: pulse * (1 - row * 0.25) };
}

export const WIND = { ribbons: 9, calmRibbons: 4, flyers: 7, calmFlyers: 3, margin: 160 };

export function gustFade(blow: number): number {
  return Math.sin(clamp01(blow) * Math.PI);
}

export interface WindRibbon {
  readonly along: number;
  readonly across: number;
  readonly length: number;
  readonly width: number;
  readonly phase: number;
}

export function windRibbon(index: number, blow: number): WindRibbon {
  return {
    along: frac(blow * 1.2 + hash(index, 17)),
    across: hash(index, 18),
    length: (90 + hash(index, 19) * 40) * MOCKUP_SCALE,
    width: (6 + hash(index, 20) * 3) * MOCKUP_SCALE,
    phase: index + blow * 6,
  };
}

export interface Flyer {
  readonly along: number;
  readonly across: number;
  readonly sway: number;
  readonly turn: number;
  readonly flip: number;
}

export function flyer(index: number, blow: number): Flyer {
  const along = frac(blow * 1.3 + hash(index, 91));
  return {
    along,
    across: hash(index, 92),
    sway: Math.sin(along * 9 + index) * 14,
    turn: along * 12 + index,
    flip: Math.cos(along * 10 + index),
  };
}

export const TRAILS = { count: 3, from: 14, to: 26, spacing: 5 };

export const EXIT_BEATS = 2;
export const CONFETTI = 14;

export interface Confetti {
  readonly x: number;
  readonly y: number;
  readonly turn: number;
  readonly flip: number;
  readonly alpha: number;
}

export function confetti(index: number, p: number): Confetti {
  return {
    x: (hash(index, 7) - 0.5) * 200,
    y: -120 + p * 260 * (0.6 + hash(index, 8) * 0.6),
    turn: p * 10 + index,
    flip: Math.cos(p * 12 + index),
    alpha: 1 - p,
  };
}

import { hash } from './hash';

// The Coup de vent's own moments, in beats and mask units unless said otherwise. Pure timing and
// geometry: `vent-face.ts`, `vent-mane.ts`, `vent-weather.ts` and `vent.ts` draw them.

const TAU = Math.PI * 2;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const frac = (value: number) => value - Math.floor(value);
const ease = (p: number) => p * p * (3 - 2 * p);
const lerp = (from: number, to: number, p: number) => from + (to - from) * p;

// His face and mane are drawn this much larger than the mockup's units.
export const SCALE = 1.3;

// The gust as the sim has it: where it blows toward, a unit vector, and its ticks.
export interface GustTimes {
  readonly x: number;
  readonly y: number;
  readonly warnTick: number;
  readonly blowTick: number;
  readonly endTick: number;
}

// Where the gust stands: warned, blowing, or settling over the beats after it; `p` runs from 0 to 1
// through each, and (x, y) is where it blows toward.
export interface GustPhase {
  readonly kind: 'warn' | 'blow' | 'settle';
  readonly p: number;
  readonly x: number;
  readonly y: number;
}

export const SETTLE_BEATS = 4;

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
    return { kind: 'warn', p: (now - warnTick) / (blowTick - warnTick), x, y };
  }
  if (now < endTick) {
    return { kind: 'blow', p: (now - blowTick) / (endTick - blowTick), x, y };
  }
  const settle = (now - endTick) / (SETTLE_BEATS * ticksPerBeat);
  return settle < 1 ? { kind: 'settle', p: settle, x, y } : undefined;
}

// How his mane streams: the way it points, how full it is (how taut and long the ribbons are) and
// how fast they wave. At rest it hangs lazily to his left; warned, it turns downwind and fills;
// blowing, it is taut and whips; then it settles back. Calm mode waves slowly and never whips.
export interface Mane {
  readonly angle: number;
  readonly fullness: number;
  readonly rate: number;
}

export const MANE = {
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
    const p = ease(phase.p);
    return {
      angle: lerp(rest.angle, downwind, p),
      fullness: lerp(rest.fullness, MANE.warnFullness, p),
      rate: lerp(rest.rate, calm ? MANE.calmRate : MANE.warnRate, p),
    };
  }
  if (phase.kind === 'blow') {
    return { angle: downwind + (calm ? 0 : 0.06 * Math.sin(beats * 6)), fullness: 1, rate: fast };
  }
  const p = ease(phase.p);
  return {
    angle: lerp(downwind, rest.angle, p),
    fullness: lerp(1, rest.fullness, p),
    rate: lerp(fast, rest.rate, p),
  };
}

// His six ribbons, by their spread round his head, drawn in this order: the outer ones behind.
export const RIBBONS: readonly number[] = [-0.6, 0.6, -0.36, 0.36, -0.12, 0.12];

export interface RibbonStart {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly length: number;
  readonly amp: number;
  readonly width: number;
}

// Where a ribbon of `spread` leaves his head and how it streams, for a mane state. In mask units.
export function ribbonStart(spread: number, state: Mane): RibbonStart {
  const { angle, fullness } = state;
  return {
    x: Math.cos(angle + spread * 2) * 16 * SCALE,
    y: Math.sin(angle + spread * 2) * 18 * SCALE,
    angle: angle + spread * (0.75 - fullness * 0.35),
    length: (62 - Math.abs(spread) * 30) * (0.7 + 0.5 * fullness) * SCALE,
    amp: 0.5 - fullness * 0.3,
    width: (12.5 - Math.abs(spread) * 5) * SCALE,
  };
}

export function ribbonIndex(spread: number): number {
  return Math.round((spread + 0.6) / 0.24);
}

// The wave along a ribbon of the mane: a swell that travels down it, stronger toward its end.
// `phase` is the wave's own clock, run by `wavePhase` so that the rate may change without a jump.
export function maneWave(phase: number, index: number, amp: number): (u: number) => number {
  return (u) => Math.sin(phase - u * 3.2 + index * 0.35) * amp * u;
}

// The wave's clock, advanced by the beats since the last image at the mane's current rate: the
// product of an absolute time by a changing rate would leap at every change of rate.
export function wavePhase(phase: number, beatsSince: number, rate: number): number {
  return phase + Math.min(1, Math.max(0, beatsSince)) * rate * 0.5;
}

export interface RibbonPoint {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly width: number;
  // The unit normal to the centerline, toward the right edge.
  readonly nx: number;
  readonly ny: number;
}

// The points of a ribbon: along its band, then round its curl. Few, so that the floor stays cheap
// to redraw every image.
export const RIBBON_STEPS = { along: 14, curl: 10 };

function ribbonPoint(x: number, y: number, angle: number, width: number): RibbonPoint {
  return { x, y, angle, width, nx: -Math.sin(angle), ny: Math.cos(angle) };
}

// A wind ribbon: a tapered band along a waving centerline that ends in a spiral curl.
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

// The warning: rows of golden chevrons stack at the edge the wind will come from, pulsing on the
// beat and creeping downwind; still in calm mode.
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

// The gust: wind ribbons with spirals cross the floor downwind, flyers tumble along, and the players
// drift with trails behind them. All fade in and out with the gust. Fewer of each in calm mode.
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
    length: (90 + hash(index, 19) * 40) * SCALE,
    width: (6 + hash(index, 20) * 3) * SCALE,
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

// Chased: his flyers fall back as confetti over the burst, each its own way.
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

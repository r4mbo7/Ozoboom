import { clamp01, frac, lerp } from '../shared/scalar';
import { easeInOutCubic, easeOutCubic } from './motion';
import { TAU } from './paint';

const EMOTE_BEATS = 4;
export const ARROW_FLIES = 8;
export const FIREWORKS = 6;
export const MOCKUP_PIXEL = 1.26;
export const FIREFLY = 3.4;
export const HAND = 3.9 * MOCKUP_PIXEL * 1.15;

export interface Fly {
  x: number;
  y: number;
  alpha: number;
  size: number;
}

export const envelope = (t: number, from: number, to: number, rise: number, fall: number) =>
  clamp01((t - from) / rise) * clamp01((to - t) / fall);
const onBeat = (t: number) => Math.exp(-frac(t) * 6);

export function emoteBeats(start: number, now: number, ticksPerBeat: number): number | null {
  const beats = (now - start) / ticksPerBeat;
  return beats >= 0 && beats < EMOTE_BEATS ? beats : null;
}

const ARROW = [
  [-14, 0],
  [-2, 0],
  [10, 0],
  [14, -20],
  [25, -10],
  [14, 20],
  [25, 10],
  [36, 0],
] as const;
const ARROW_RANK = [0, 1, 2, 3, 4, 3, 4, 5] as const;
const ARROW_HAND = { x: 26, y: 3 };

export function arrowFly(index: number, t: number, calm: boolean, out: Fly): Fly {
  const [px, py] = ARROW[index] ?? [0, 0];
  const drift = calm ? 0 : 7 * Math.min(t, 3.6);
  const flown = calm ? clamp01(t / 0.5) : easeInOutCubic(clamp01((t - 0.2 - index * 0.06) / 0.9));
  out.x = lerp(ARROW_HAND.x, 46 + drift + px, flown) * MOCKUP_PIXEL;
  out.y = lerp(ARROW_HAND.y, py, flown) * MOCKUP_PIXEL;
  let alpha = clamp01((3.95 - t) / 0.4);
  if (calm) {
    alpha *= flown;
  } else if (flown >= 1) {
    const rank = ARROW_RANK[index] ?? 0;
    alpha *= 0.45 + 0.55 * Math.exp(-(((frac(t * 2) - rank / 6) * 5) ** 2));
  }
  out.alpha = alpha;
  out.size = (index === ARROW_FLIES - 1 ? 2.8 : 2.2) * MOCKUP_PIXEL;
  return out;
}

export function arrowHand(t: number): { x: number; y: number; raised: number } {
  const raised = envelope(t, 0, 1.2, 0.25, 0.4);
  return {
    x: lerp(0, ARROW_HAND.x, raised) * MOCKUP_PIXEL,
    y: lerp(15, ARROW_HAND.y, raised) * MOCKUP_PIXEL,
    raised,
  };
}

export function fireworksFly(index: number, t: number, calm: boolean, out: Fly): Fly {
  const base = (index / FIREWORKS) * TAU;
  if (t < 1.6) {
    const up = easeOutCubic(clamp01(t / 1.6));
    const angle = base + 1.3 * (calm ? 1 : up);
    const radius = calm ? 32 : 6 + 26 * up;
    out.x = Math.cos(angle) * radius * MOCKUP_PIXEL;
    out.y = (Math.sin(angle) * radius - 8 * (calm ? 1 : up)) * MOCKUP_PIXEL;
    out.size = 2.1 * (1 + 0.5 * up) * MOCKUP_PIXEL;
    out.alpha = calm ? up : 1;
    return out;
  }
  const fall = (t - 1.6) / 2.4;
  out.x = Math.cos(base + 1.3) * 32 * MOCKUP_PIXEL;
  out.y = (Math.sin(base + 1.3) * 32 - 8 + (calm ? 0 : 8 * fall * fall)) * MOCKUP_PIXEL;
  out.size = 2.4 * (1 - fall) * MOCKUP_PIXEL;
  out.alpha = 1 - fall;
  return out;
}

export function fireworksBurst(t: number, calm: boolean): { reach: number; alpha: number } | null {
  if (t < 1.6) {
    return null;
  }
  const fall = (t - 1.6) / 2.4;
  return {
    reach: (calm ? 8 : 3 + 10 * easeOutCubic(clamp01(fall * 2.5))) * MOCKUP_PIXEL,
    alpha: (1 - fall) * (calm ? 1 : 0.6 + 0.4 * onBeat(t * 2)),
  };
}

export interface HeartMoment {
  readonly hand: { readonly x: number; readonly y: number };
  readonly hands: number;
  readonly rise: number;
  readonly scale: number;
  readonly alpha: number;
  readonly star: { readonly size: number; readonly alpha: number } | null;
}

export const HEART_FRONT = 28 * MOCKUP_PIXEL;

export function heartAt(t: number, calm: boolean): HeartMoment {
  const hands = easeOutCubic(clamp01(t / 0.4)) * clamp01((3.8 - t) / 0.4);
  const out = (t - 0.4) / 3.3;
  const shown = out > 0 && out < 1;
  let star: HeartMoment['star'] = null;
  for (const beat of [1, 2, 3]) {
    const since = (t - beat) / 0.6;
    if (!calm && since >= 0 && since < 1) {
      star = { size: 1 - since * 0.5, alpha: 1 - since };
    }
  }
  return {
    hand: { x: lerp(0, 13, hands) * MOCKUP_PIXEL, y: lerp(-15, -4.5, hands) * MOCKUP_PIXEL },
    hands,
    rise: (calm ? 22 : 4 + 24 * easeOutCubic(clamp01(out))) * MOCKUP_PIXEL,
    scale: calm ? 1.1 : 0.5 + 0.7 * easeOutCubic(clamp01(out * 1.6)) + 0.16 * onBeat(t),
    alpha: shown ? clamp01(out * 6) * clamp01((1 - out) * 4) : 0,
    star,
  };
}

export function sunRay(index: number, t: number, calm: boolean): number {
  const open = calm ? 1 : easeOutCubic(clamp01((t - 0.8 - index * 0.1) / 0.3));
  return open * (5 + (calm || t <= 1.3 ? 0 : 1.6 * onBeat(t))) * MOCKUP_PIXEL;
}

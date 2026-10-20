import { TAU } from './paint';

// A gesture lasts a bar, counted from the press.
export const EMOTE_BEATS = 4;
export const ARROW_FLIES = 8;
export const FIREWORKS = 6;
// The gestures were chosen drawn on shoulders 19 units tall; these are their reference pixels.
export const K = 1.26;
export const FIREFLY = 3.4;
export const HAND = 3.9 * K * 1.15;

export interface Fly {
  x: number;
  y: number;
  alpha: number;
  size: number;
}

export const clamp = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - (1 - clamp(t)) ** 3;
const easeInOut = (t: number) => {
  const c = clamp(t);
  return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2;
};
export const envelope = (t: number, from: number, to: number, rise: number, fall: number) =>
  clamp((t - from) / rise) * clamp((to - t) / fall);
const frac = (v: number) => v - Math.floor(v);
// 1 on the beat, fading before the next.
const onBeat = (t: number) => Math.exp(-frac(t) * 6);

// Beats since a gesture began, while it lasts; null before and after.
export function emoteBeats(start: number, now: number, ticksPerBeat: number): number | null {
  const beats = (now - start) / ticksPerBeat;
  return beats >= 0 && beats < EMOTE_BEATS ? beats : null;
}

// The arrow of "Regarde !", along +x, the aim of the player: a shaft, two wings and the tip.
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

// Firefly `index` of the arrow, in reference pixels, the aim along +x: out of the hand, into the
// arrow that moves on each beat, lit from the heel to the tip.
export function arrowFly(index: number, t: number, calm: boolean, out: Fly): Fly {
  const [px, py] = ARROW[index] ?? [0, 0];
  const drift = calm ? 0 : 7 * Math.min(t, 3.6);
  const flown = calm ? clamp(t / 0.5) : easeInOut((t - 0.2 - index * 0.06) / 0.9);
  out.x = lerp(ARROW_HAND.x, 46 + drift + px, flown) * K;
  out.y = lerp(ARROW_HAND.y, py, flown) * K;
  let alpha = clamp((3.95 - t) / 0.4);
  if (calm) {
    alpha *= flown;
  } else if (flown >= 1) {
    const rank = ARROW_RANK[index] ?? 0;
    alpha *= 0.45 + 0.55 * Math.exp(-(((frac(t * 2) - rank / 6) * 5) ** 2));
  }
  out.alpha = alpha;
  out.size = (index === ARROW_FLIES - 1 ? 2.8 : 2.2) * K;
  return out;
}

// The hand that points the arrow, the aim along +x, and how far it is raised.
export function arrowHand(t: number): { x: number; y: number; raised: number } {
  const raised = envelope(t, 0, 1.2, 0.25, 0.4);
  return { x: lerp(0, ARROW_HAND.x, raised) * K, y: lerp(15, ARROW_HAND.y, raised) * K, raised };
}

// Firefly `index` of the fireworks, on screen around the player: up in a spiral that grows as it
// nears the eye, then burst on the third beat and falling as it fades.
export function fireworksFly(index: number, t: number, calm: boolean, out: Fly): Fly {
  const base = (index / FIREWORKS) * TAU;
  if (t < 1.6) {
    const up = easeOut(t / 1.6);
    const angle = base + 1.3 * (calm ? 1 : up);
    const radius = calm ? 32 : 6 + 26 * up;
    out.x = Math.cos(angle) * radius * K;
    out.y = (Math.sin(angle) * radius - 8 * (calm ? 1 : up)) * K;
    out.size = 2.1 * (1 + 0.5 * up) * K;
    out.alpha = calm ? up : 1;
    return out;
  }
  const fall = (t - 1.6) / 2.4;
  out.x = Math.cos(base + 1.3) * 32 * K;
  out.y = (Math.sin(base + 1.3) * 32 - 8 + (calm ? 0 : 8 * fall * fall)) * K;
  out.size = 2.4 * (1 - fall) * K;
  out.alpha = 1 - fall;
  return out;
}

// The star a firefly of the fireworks bursts into, in reference pixels; null before it bursts.
export function fireworksBurst(t: number, calm: boolean): { reach: number; alpha: number } | null {
  if (t < 1.6) {
    return null;
  }
  const fall = (t - 1.6) / 2.4;
  return {
    reach: (calm ? 8 : 3 + 10 * easeOut(fall * 2.5)) * K,
    alpha: (1 - fall) * (calm ? 1 : 0.6 + 0.4 * onBeat(t * 2)),
  };
}

export interface HeartMoment {
  // The left hand, the aim along +x; the right one mirrors it.
  readonly hand: { readonly x: number; readonly y: number };
  readonly hands: number;
  // How high above the hands the heart has gone, on screen, in reference pixels.
  readonly rise: number;
  readonly scale: number;
  readonly alpha: number;
  readonly star: { readonly size: number; readonly alpha: number } | null;
}

export const HEART_FRONT = 28 * K;

// The heart of "Merci": the hands join in front, the heart comes out of them, rises and beats.
export function heartAt(t: number, calm: boolean): HeartMoment {
  const hands = easeOut(t / 0.4) * clamp((3.8 - t) / 0.4);
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
    hand: { x: lerp(0, 13, hands) * K, y: lerp(-15, -4.5, hands) * K },
    hands,
    rise: (calm ? 22 : 4 + 24 * easeOut(out)) * K,
    scale: calm ? 1.1 : 0.5 + 0.7 * easeOut(out * 1.6) + 0.16 * onBeat(t),
    alpha: shown ? clamp(out * 6) * clamp((1 - out) * 4) : 0,
    star,
  };
}

// How long ray `index` of the sunrise is, in reference pixels: they open one after the other, then
// beat with the music.
export function sunRay(index: number, t: number, calm: boolean): number {
  const open = calm ? 1 : easeOut((t - 0.8 - index * 0.1) / 0.3);
  return open * (5 + (calm || t <= 1.3 ? 0 : 1.6 * onBeat(t))) * K;
}

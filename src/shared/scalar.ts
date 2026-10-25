export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(from: number, to: number, share: number): number {
  return from + (to - from) * share;
}

export function frac(value: number): number {
  return value - Math.floor(value);
}

export function wrap(index: number, count: number): number {
  return ((index % count) + count) % count;
}

export function smoothstep(share: number): number {
  return share * share * (3 - 2 * share);
}

import { clamp01 } from './scalar';

// The share of life under which a character is in danger: the life arc and the screen frame go
// into alarm together (#489, lowered from a quarter so that the alarm still says "danger").
export const DANGER_RATIO = 0.15;

// How deep into danger a share of life is: nothing at the threshold, everything at none.
export function dangerDepth(fraction: number): number {
  return clamp01(1 - fraction / DANGER_RATIO);
}

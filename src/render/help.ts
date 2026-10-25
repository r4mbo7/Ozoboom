import { clamp01 } from '../shared/scalar';

export const RING_STEPS = 24;

export function ringStep(helpTicks: number, helpTotal: number): number {
  if (!(helpTotal > 0)) {
    return 0;
  }
  return Math.round(clamp01(helpTicks / helpTotal) * RING_STEPS);
}

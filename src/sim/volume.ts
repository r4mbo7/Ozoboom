import type { SimState } from './state';

export const VOLUME_STEP = 0.25;

export function volumeMul(state: SimState): number {
  return 1 + VOLUME_STEP * (state.volume ?? 0);
}

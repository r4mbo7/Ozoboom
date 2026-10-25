import type { SimState } from './state';

const VOLUME_STEP = 0.25;

export function volumeMul(state: SimState): number {
  return 1 + VOLUME_STEP * (state.volume ?? 0);
}

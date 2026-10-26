import type { SimState } from '../sim/state';

// One record per night: a scene's set, endless or not, or the whole festival.
export function recordKey(state: SimState): string {
  if (state.festival !== undefined) {
    return 'ozoboom.record.festival';
  }
  const endless = state.set.endlessFromTick === undefined ? '' : '.endless';
  return `ozoboom.record.${state.setId}${endless}`;
}

// The record before this score, null when none was kept; a storage that fails keeps none.
export function keepRecord(
  storage: () => Storage | null,
  state: SimState,
  score: number,
): number | null {
  const key = recordKey(state);
  try {
    const stored = Number(storage()?.getItem(key) ?? Number.NaN);
    const best = Number.isInteger(stored) && stored >= 0 ? stored : null;
    if (best === null || score > best) {
      storage()?.setItem(key, String(score));
    }
    return best;
  } catch (error) {
    if (error instanceof DOMException) {
      return null;
    }
    throw error;
  }
}

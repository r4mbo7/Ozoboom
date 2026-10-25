import type { SimState } from './state';

export function blackedOut(state: SimState): boolean {
  const { blackout } = state;
  return (
    blackout !== undefined && state.tick >= blackout.startTick && state.tick < blackout.endTick
  );
}

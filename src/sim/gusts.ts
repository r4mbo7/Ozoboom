import type { GustState, SimState, Vec2 } from './state';
import type { StepContext } from './systems/types';

// How hard the gust blows at `tick`, from 0 to 1: it rises over the first quarter of its bar and
// falls over the last.
export function gustStrength(gust: GustState, tick: number): number {
  const { blowTick, endTick } = gust;
  if (tick < blowTick || tick >= endTick) {
    return 0;
  }
  const p = (tick - blowTick) / (endTick - blowTick);
  return Math.min(1, p * 4, (1 - p) * 4);
}

// What the gust drifts whatever is light by this tick, in pixels; undefined while nothing blows.
export function gustDrift(state: SimState): Vec2 | undefined {
  const { gust } = state;
  if (gust === undefined) {
    return undefined;
  }
  const strength = gustStrength(gust, state.tick);
  return strength === 0
    ? undefined
    : { x: gust.x * gust.push * strength, y: gust.y * gust.push * strength };
}

// Before the players move: the gust of the Coup de vent begins to blow on its tick, and is gone on
// its last, whoever raised it still standing or not.
export function gusts({ state }: StepContext): void {
  const { gust } = state;
  if (gust === undefined) {
    return;
  }
  if (state.tick === gust.blowTick) {
    state.events.push({ type: 'gust', x: gust.x, y: gust.y });
  }
  if (state.tick >= gust.endTick) {
    delete state.gust;
  }
}

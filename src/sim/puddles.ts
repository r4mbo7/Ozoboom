import type { PuddleState, SimState } from './state';
import type { StepContext } from './systems/types';

const SHORTED_AFTER_PUDDLE_TICKS = 2;
export const ORPHANED_PUDDLE_BEATS = 8;
export const PUDDLE_STRETCH = { x: 1.25, y: 0.8 };

export function layPuddle(state: SimState, puddle: Omit<PuddleState, 'id'>): PuddleState {
  const laid: PuddleState = { id: state.nextEntityId, ...puddle };
  state.nextEntityId += 1;
  (state.puddles ??= []).push(laid);
  return laid;
}

function inPuddle(at: { readonly x: number; readonly y: number }, puddle: PuddleState) {
  const dx = (at.x - puddle.x) / PUDDLE_STRETCH.x;
  const dy = (at.y - puddle.y) / PUDDLE_STRETCH.y;
  return dx * dx + dy * dy < puddle.radius * puddle.radius;
}

// Before the traps fire.
export function puddles({ state, tempo }: StepContext): void {
  const laid = state.puddles;
  if (laid === undefined) {
    return;
  }
  const evaporateAt = state.tick + ORPHANED_PUDDLE_BEATS * tempo.ticksPerBeat;
  for (const puddle of laid) {
    if (
      puddle.driesTick > evaporateAt &&
      !state.enemies.some((enemy) => enemy.id === puddle.byId && enemy.hp > 0)
    ) {
      puddle.driesTick = evaporateAt;
    }
    for (const trap of state.traps) {
      if (inPuddle(trap, puddle)) {
        trap.shortedTicks = SHORTED_AFTER_PUDDLE_TICKS;
      }
    }
  }
  const wet = laid.filter((puddle) => puddle.driesTick > state.tick);
  if (wet.length === 0) {
    delete state.puddles;
  } else if (wet.length < laid.length) {
    state.puddles = wet;
  }
}

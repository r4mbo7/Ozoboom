import type { SetDefinition } from '../data/types';
import { lineupSlots } from '../sim/lineup';
import type { SimState } from '../sim/state';
import { TICKS_PER_BAR, TICKS_PER_PHRASE } from '../shared/tempo';

const DROP_RAMP_TICKS = 4 * TICKS_PER_BAR;

// Moves the set progress of a fixture so that setFraction(set, state) reads `fraction`, whatever the tick.
export function pinFraction(state: SimState, set: SetDefinition, fraction: number): void {
  const slots = lineupSlots(set);
  const position = Math.min(1, Math.max(0, fraction)) * slots.length;
  const index = Math.min(Math.floor(position), slots.length - 1);
  const slot = slots[index];
  const inSlot = position - index;
  if (slot === undefined || slot.kind === 'sunrise') {
    state.status = 'won';
    return;
  }
  const tier = set.tiers[slot.tier];
  const length = {
    phrase: TICKS_PER_PHRASE,
    break: (tier?.breakBars ?? 0) * TICKS_PER_BAR,
    drop: DROP_RAMP_TICKS,
  }[slot.kind];
  const elapsed = Math.round(((slot.kind === 'phrase' ? slot.phrase : 0) + inSlot) * length);
  state.status = 'running';
  state.set.tier = slot.tier;
  state.set.segment = slot.kind === 'phrase' ? 'buildup' : slot.kind;
  state.set.segmentStartTick = state.tick - elapsed;
}

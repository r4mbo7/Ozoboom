import type { TrapDefinition, TrapDraw } from '../data/types';
import { type RngState, nextFloat } from '../shared/prng';

// A trap at the carriers' odds: those of the traps, or the stage's own (`SimState.trapDraw`).
export function drawCarriersTrap(
  rng: RngState,
  traps: ReadonlyMap<string, TrapDefinition>,
  draw: TrapDraw | undefined,
): string {
  return drawTrap(rng, trapOdds([...traps.values()], draw));
}

function trapOdds(
  traps: readonly TrapDefinition[],
  draw: TrapDraw | undefined,
): readonly Pick<TrapDefinition, 'id' | 'carrierWeight'>[] {
  if (draw === undefined) {
    return traps;
  }
  return traps.map(({ id }) => ({ id, carrierWeight: draw.weights[id] ?? 0 }));
}

export function drawTrap(
  rng: RngState,
  traps: readonly Pick<TrapDefinition, 'id' | 'carrierWeight'>[],
): string {
  const total = traps.reduce((sum, trap) => sum + trap.carrierWeight, 0);
  let roll = nextFloat(rng) * total;
  for (const trap of traps) {
    roll -= trap.carrierWeight;
    if (roll < 0) {
      return trap.id;
    }
  }
  const last = traps.at(-1);
  if (last === undefined) {
    throw new Error('A trap draw needs at least one trap');
  }
  return last.id;
}

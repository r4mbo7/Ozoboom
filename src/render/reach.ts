import type { TrapEffect } from '../data/types';
import type { PlayerState } from '../sim/state';
import { statValue } from '../sim/stats';

// As far as the sim reaches: `power` is the trap's from its wear (`trapPower`).
export function trapReach(
  effect: TrapEffect,
  owner: Pick<PlayerState, 'modifiers'>,
  power: number,
): number {
  const base = effect.kind === 'beam' || effect.kind === 'breeze' ? effect.length : effect.radius;
  return base * statValue(owner, 'trapRadiusMul', 1) * power;
}

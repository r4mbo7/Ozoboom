import type { TrapEffect } from '../data/types';
import type { PlayerState } from '../sim/state';
import { statValue } from '../sim/stats';

export function trapReach(effect: TrapEffect, owner: Pick<PlayerState, 'modifiers'>): number {
  const base = effect.kind === 'beam' ? effect.length : effect.radius;
  return base * statValue(owner, 'trapRadiusMul', 1);
}

import type { DashDefinition } from '../data/types';
import { ticksIntoBeat, type Tempo } from '../shared/tempo';
import type { PlayerState } from './state';
import { dashCharges, dashRechargeBeats } from './stats';

export interface DashGauge {
  charges: number;
  ready: number;
  fill: number;
}

export function dashGauge(
  player: Pick<
    PlayerState,
    'modifiers' | 'suppressedTicks' | 'boosts' | 'dashesSpent' | 'dashBeats'
  >,
  dash: DashDefinition,
  now: number,
  tempo: Tempo,
): DashGauge {
  const charges = dashCharges(player, dash);
  const spent = Math.min(charges, player.dashesSpent ?? 0);
  if (spent === 0) {
    return { charges, ready: charges, fill: 0 };
  }
  const phase = ticksIntoBeat(now, tempo) / tempo.ticksPerBeat;
  const fill = Math.min(1, ((player.dashBeats ?? 0) + phase) / dashRechargeBeats(player, dash));
  return { charges, ready: charges - spent, fill };
}

import type { ClassDefinition, GaugeDefinition } from '../data/types';
import type { PlayerState } from './state';
import type { StepContext } from './systems/types';

// Fills and drains the gauge of a player, each tick; registered by kind in `GAUGES` (systems/gauges.ts).
export type GaugeModule = (
  ctx: StepContext,
  player: PlayerState,
  gauge: GaugeDefinition,
  definition: ClassDefinition,
) => void;

export function gaugeValue(player: Pick<PlayerState, 'gauge'>): number {
  return player.gauge ?? 0;
}

export function setGauge(
  player: Pick<PlayerState, 'id' | 'gauge'>,
  gauge: Pick<GaugeDefinition, 'max'>,
  value: number,
): void {
  if (player.gauge === undefined) {
    throw new Error(`player ${String(player.id)} has no gauge`);
  }
  player.gauge = Math.min(gauge.max, Math.max(0, value));
}

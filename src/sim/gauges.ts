import type { ClassDefinition, GaugeDefinition } from '../data/types';
import { clamp } from '../shared/scalar';
import type { PlayerState } from './state';
import type { StepContext } from './systems/types';

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
  player.gauge = clamp(value, 0, gauge.max);
}

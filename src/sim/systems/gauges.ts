import { FULL_GAUGES } from '../full';
import type { GaugeModule } from '../gauges';
import { kiffGauge } from '../gauges/kiff';
import type { StepContext } from './types';

export const GAUGES: Record<string, GaugeModule> = { kiff: kiffGauge, ...FULL_GAUGES };

// After `deaths`, so that a module sees every hit and every fall of the tick; downed players too.
export function gauges(ctx: StepContext): void {
  for (const player of ctx.state.players) {
    if (player.gauge === undefined) {
      continue;
    }
    const definition = ctx.content.classes.get(player.classId);
    const gauge = definition?.gauge;
    const module = gauge === undefined ? undefined : GAUGES[gauge.kind];
    if (definition === undefined || gauge === undefined || module === undefined) {
      throw new Error(
        `no gauge module for player ${String(player.id)} of class "${player.classId}"`,
      );
    }
    module(ctx, player, gauge, definition);
  }
}

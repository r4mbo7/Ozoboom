import type { SimEvent, SimState } from '../sim/state';
import { Bursts } from './bursts';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { PickupBurstPlanner } from './pickup-burst-specs';
import { byId } from './util';

const CAPACITY = 64;

export function createPickupBursts(ctx: RenderContext): Family {
  const { textures: t } = ctx;
  const bursts = new Bursts(ctx.layers.fx, CAPACITY, t.ring);
  const planner = new PickupBurstPlanner();

  function reset(): void {
    bursts.clear();
    planner.reset();
  }

  return {
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      if (event.type !== 'pickupCollected') {
        return;
      }
      const collector = byId(state.players, event.playerId);
      if (collector === undefined) {
        return;
      }
      const specs = planner.plan(state.tick, collector, {
        ring: t.ring,
        spark: t.vibes,
        tint: frame.palette.or,
        calm: frame.calm,
        ticksPerBeat: frame.tempo.ticksPerBeat,
      });
      for (const spec of specs) {
        bursts.spawn(spec);
      }
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      bursts.update(state, alpha, frame);
    },
    reset,
    destroy: reset,
  };
}

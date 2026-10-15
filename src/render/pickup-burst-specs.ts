import type { PlayerState } from '../sim/state';
import type { BurstSpec } from './bursts';
import type { Shape } from './paint';

const TAU = Math.PI * 2;
const RING = { from: 0.8, to: 2.4, peak: 0.9, beats: 0.5 };
const CALM_RING = { peak: 0.45, beats: 1 };
const SPARKS = { count: 5, near: 20, far: 40, fromRadius: 6, toRadius: 3.5, spin: 2.7 };

export interface PickupBurstLook {
  readonly ring: Shape;
  readonly spark: Shape;
  readonly tint: number;
  readonly calm: boolean;
  readonly ticksPerBeat: number;
}

// One burst per tick at most: forty vibes pulled in together must not drown the player.
export class PickupBurstPlanner {
  private lastTick = Number.NEGATIVE_INFINITY;

  plan(
    tick: number,
    collector: Pick<PlayerState, 'id' | 'radius'>,
    look: PickupBurstLook,
  ): BurstSpec[] {
    if (tick === this.lastTick) {
      return [];
    }
    this.lastTick = tick;
    const { calm, tint, ticksPerBeat } = look;
    const base = { now: tick, x: 0, y: 0, anchor: 'player', anchorId: collector.id, tint } as const;
    const specs: BurstSpec[] = [
      {
        ...base,
        shape: look.ring,
        duration: ticksPerBeat * (calm ? CALM_RING.beats : RING.beats),
        fromRadius: collector.radius * RING.from,
        toRadius: collector.radius * RING.to,
        peak: calm ? CALM_RING.peak : RING.peak,
        outline: true,
      },
    ];
    if (calm) {
      return specs;
    }
    for (let index = 0; index < SPARKS.count; index += 1) {
      const angle = ((index + ((tick * 0.618) % 1)) / SPARKS.count) * TAU;
      const reach =
        collector.radius + SPARKS.near + (SPARKS.far - SPARKS.near) * (((index * 3) % 5) / 4);
      specs.push({
        ...base,
        shape: look.spark,
        duration: ticksPerBeat * RING.beats,
        dx: Math.cos(angle) * reach,
        dy: Math.sin(angle) * reach,
        fromRadius: SPARKS.fromRadius,
        toRadius: SPARKS.toRadius,
        angle,
        spin: SPARKS.spin,
        peak: 1,
        outline: true,
      });
    }
    return specs;
  }

  reset(): void {
    this.lastTick = Number.NEGATIVE_INFINITY;
  }
}

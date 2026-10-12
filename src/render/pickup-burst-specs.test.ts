import { describe, expect, it } from 'vitest';
import type { Shape } from './paint';
import { type PickupBurstLook, PickupBurstPlanner } from './pickup-burst-specs';

const RING = { radius: 54 } as Shape;
const SPARK = { radius: 12 } as Shape;
const GOLD = 0xffd27a;
const TICKS_PER_BEAT = 12;
const COLLECTOR = { id: 3, radius: 14 } as const;

function look(calm = false): PickupBurstLook {
  return { ring: RING, spark: SPARK, tint: GOLD, calm, ticksPerBeat: TICKS_PER_BEAT };
}

describe('PickupBurstPlanner', () => {
  it('opens a gold ring and five sparks around the collector for half a beat', () => {
    const planner = new PickupBurstPlanner();

    const specs = planner.plan(40, COLLECTOR, look());

    const rings = specs.filter((spec) => spec.shape === RING);
    const sparks = specs.filter((spec) => spec.shape === SPARK);
    expect(rings).toHaveLength(1);
    expect(sparks).toHaveLength(5);
    expect(rings[0]?.toRadius).toBeGreaterThan(rings[0]?.fromRadius ?? Number.NaN);
    expect(new Set(sparks.map((spec) => spec.angle)).size).toBe(5);
    for (const spec of specs) {
      expect(spec).toMatchObject({
        now: 40,
        duration: TICKS_PER_BEAT / 2,
        tint: GOLD,
        anchor: 'player',
        anchorId: COLLECTOR.id,
        x: 0,
        y: 0,
      });
    }
  });

  it('throws the sparks past the edge of the collector', () => {
    const planner = new PickupBurstPlanner();

    const sparks = planner.plan(40, COLLECTOR, look()).filter((spec) => spec.shape === SPARK);

    for (const spark of sparks) {
      expect(Math.hypot(spark.dx ?? 0, spark.dy ?? 0)).toBeGreaterThan(COLLECTOR.radius);
    }
  });

  it('bursts once when forty vibes are collected on the same tick', () => {
    const planner = new PickupBurstPlanner();

    const bursts = Array.from({ length: 40 }, () => planner.plan(40, COLLECTOR, look()));

    expect(bursts.filter((specs) => specs.length > 0)).toHaveLength(1);
  });

  it('bursts again on the next tick', () => {
    const planner = new PickupBurstPlanner();
    planner.plan(40, COLLECTOR, look());

    const specs = planner.plan(41, COLLECTOR, look());

    expect(specs).toHaveLength(6);
  });

  it('bursts on the same tick of a new game once reset', () => {
    const planner = new PickupBurstPlanner();
    planner.plan(40, COLLECTOR, look());

    planner.reset();

    expect(planner.plan(40, COLLECTOR, look())).toHaveLength(6);
  });

  it('keeps only the ring in calm mode, slower and at half strength', () => {
    const lively = new PickupBurstPlanner().plan(40, COLLECTOR, look());
    const planner = new PickupBurstPlanner();

    const calm = planner.plan(40, COLLECTOR, look(true));

    const ring = lively.find((spec) => spec.shape === RING);
    expect(calm).toHaveLength(1);
    expect(calm[0]?.shape).toBe(RING);
    expect(calm[0]?.duration).toBe(TICKS_PER_BEAT);
    expect(calm[0]?.peak).toBeCloseTo((ring?.peak ?? Number.NaN) / 2);
  });
});

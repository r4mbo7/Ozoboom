import { describe, expect, it } from 'vitest';
import { SETS } from '../data/sets';
import { armPath, clearSpot, clusterReach, giantClusters, layGiants } from './giants-layout';

const dome = SETS.find((set) => set.id === 'dome');

describe('layGiants', () => {
  it('gives four giants nine stones each, split in two arms that run from the body out', () => {
    const giants = layGiants(dome?.obstacles ?? [], { x: 800, y: 500 });

    expect(giants).toHaveLength(4);
    for (const { arms } of giants) {
      expect(arms[0].stones.length + arms[1].stones.length).toBe(9);
    }
    const [first] = giants;
    const reach = (stone: { x: number; y: number }) => Math.hypot(stone.x - 800, stone.y - 500);
    expect(first?.arms[0].stones.length).toBeGreaterThan(0);
    expect(reach(first?.arms[0].stones[0] ?? { x: 0, y: 0 })).toBeGreaterThan(400);
  });

  it('runs each arm over its stones, and joins the hands of two neighbours over each entrance', () => {
    const center = { x: 800, y: 500 };
    const giants = layGiants(dome?.obstacles ?? [], center);

    const arms = giants.flatMap((giant) =>
      ([0, 1] as const).map((arm) => ({
        stones: giant.arms[arm].stones,
        ...armPath(giant, center, arm),
      })),
    );

    for (const { stones, points, underTorso } of arms) {
      expect(points.length - 2 + underTorso.length).toBe(stones.length);
    }
    const hands = arms.map(({ points }) => points.at(-1) ?? center);
    expect(new Set(hands.map(({ x, y }) => `${x.toFixed(0)},${y.toFixed(0)}`)).size).toBe(4);
    expect(hands.every(({ x, y }) => Math.abs(x - 800) < 0.5 || Math.abs(y - 500) < 0.5)).toBe(
      true,
    );
  });

  it('leaves out the posts of the crown', () => {
    const posts = (dome?.obstacles ?? []).filter(({ radius }) => radius === 24).length;
    const stones = layGiants(dome?.obstacles ?? [], { x: 800, y: 500 }).flatMap(({ arms }) =>
      arms.flatMap(({ stones: list }) => list),
    );

    expect(stones).toHaveLength((dome?.obstacles?.length ?? 0) - posts);
  });

  it('keeps two clusters per giant, clear of every speaker and obstacle', () => {
    const center = { x: 800, y: 500 };
    const avoid = [...(dome?.obstacles ?? []), ...(dome?.speakers ?? [])];

    const clusters = giantClusters(layGiants(dome?.obstacles ?? [], center), center, avoid, 30);

    expect(clusters).toHaveLength(8);
    for (const at of clusters) {
      for (const disc of avoid) {
        expect(Math.hypot(at.x - disc.x, at.y - disc.y)).toBeGreaterThanOrEqual(
          disc.radius + clusterReach(30),
        );
      }
    }
  });

  it('moves a corner cluster off a speaker and leaves a free one alone', () => {
    const speaker = { x: 100, y: 100, radius: 30 };

    expect(clearSpot({ x: 500, y: 500 }, 60, [speaker])).toEqual({ x: 500, y: 500 });
    const moved = clearSpot({ x: 100, y: 100 }, 60, [speaker]);
    expect(Math.hypot(moved.x - 100, moved.y - 100)).toBeGreaterThanOrEqual(30 + clusterReach(60));
  });
});

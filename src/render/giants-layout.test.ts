import { describe, expect, it } from 'vitest';
import { SETS } from '../data/sets';
import { layGiants } from './giants-layout';

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

  it('leaves out the posts of the crown', () => {
    const posts = (dome?.obstacles ?? []).filter(({ radius }) => radius === 24).length;
    const stones = layGiants(dome?.obstacles ?? [], { x: 800, y: 500 }).flatMap(({ arms }) =>
      arms.flatMap(({ stones: list }) => list),
    );

    expect(stones).toHaveLength((dome?.obstacles?.length ?? 0) - posts);
  });
});

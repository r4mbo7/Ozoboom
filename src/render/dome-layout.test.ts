import { describe, expect, it } from 'vitest';
import { SETS } from '../data/sets';
import { RIBS, crownPosts, garlands } from './dome-layout';

const dome = SETS.find((set) => set.id === 'dome');
const center = { x: (dome?.arena.width ?? 0) / 2, y: (dome?.arena.height ?? 0) / 2 };

describe('The dome decor layout', () => {
  it('Given the Dome obstacles, when posts are picked, then only the 20 crown posts remain', () => {
    const posts = crownPosts(dome?.obstacles ?? [], center);

    expect(posts).toHaveLength(20);
    expect(posts.every((post) => post.radius === 24)).toBe(true);
  });

  it('Given a seed, when garlands are laid, then they are repeatable and spread over every rib', () => {
    const lights = garlands(7, center);

    expect(garlands(7, center)).toEqual(lights);
    expect(lights.length).toBeGreaterThan(RIBS * 4);
  });
});

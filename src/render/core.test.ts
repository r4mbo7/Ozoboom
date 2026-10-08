import { describe, expect, it } from 'vitest';
import { LIT_FACETS, litFacets } from './core';
import { DOME_FACETS } from './textures';

describe('dome facets', () => {
  it('splits the dome into a decagon of facets around a pentagon top', () => {
    expect(DOME_FACETS).toHaveLength(25);
  });

  it.each([0, 1, 7, 63, 1024])('lights three distinct facets on beat %i', (beat) => {
    const lit = litFacets(beat);

    expect(lit).toHaveLength(LIT_FACETS);
    expect(new Set(lit).size).toBe(LIT_FACETS);
    for (const facet of lit) {
      expect(DOME_FACETS).toContain(facet);
    }
  });

  it('lights the same facets on the same beat', () => {
    expect(litFacets(42)).toEqual(litFacets(42));
  });

  it('moves the light from one beat to the next', () => {
    const changes = Array.from({ length: 16 }, (_, beat) =>
      litFacets(beat)
        .map((facet) => DOME_FACETS.indexOf(facet))
        .join(),
    ).filter((lit, beat, all) => beat > 0 && lit !== all[beat - 1]);

    expect(changes).toHaveLength(15);
  });
});

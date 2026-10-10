import { describe, expect, it } from 'vitest';
import {
  PALETTE_TOKENS,
  SAND_PALETTES,
  SUN_PALETTES,
  lightAt,
  paletteAt,
  relativeLuminance,
  sandAt,
} from './palette';

const HEX = /^#[0-9a-f]{6}$/;

describe('paletteAt', () => {
  it('gives the table exactly at the four moments', () => {
    expect(paletteAt(0)).toEqual(SUN_PALETTES.crepuscule);
    expect(paletteAt(0.25)).toEqual(SUN_PALETTES.nuit);
    expect(paletteAt(0.4)).toEqual(SUN_PALETTES.nuit);
    expect(paletteAt(0.6)).toEqual(SUN_PALETTES.nuit);
    expect(paletteAt(0.85)).toEqual(SUN_PALETTES.aube);
    expect(paletteAt(1)).toEqual(SUN_PALETTES.jour);
  });

  it('blends halfway between two moments', () => {
    expect(paletteAt(0.125).sol).toBe('#181126');
    expect(paletteAt(0.925).texte).toBe('#2c1f14');
  });

  it('gives a red for the scene in danger at every moment, blended like the others', () => {
    expect(paletteAt(0).rouge).toBe('#ff5a52');
    expect(paletteAt(0.4).rouge).toBe('#ff5a52');
    expect(paletteAt(0.725).rouge).toBe('#d94038');
    expect(paletteAt(0.85).rouge).toBe('#b3261e');
    expect(paletteAt(1).rouge).toBe('#be281d');
  });

  it('changes continuously between the moments', () => {
    for (const [from, to] of [
      [0, 0.25],
      [0.6, 0.85],
      [0.85, 1],
    ] as const) {
      const middle = paletteAt((from + to) / 2);

      expect(middle.sol).not.toBe(paletteAt(from).sol);
      expect(middle.sol).not.toBe(paletteAt(to).sol);
    }
  });

  it('returns every token as #rrggbb and clamps the fraction', () => {
    for (const fraction of [-1, 0.1, 0.7, 0.99, 2]) {
      for (const token of PALETTE_TOKENS) {
        expect(paletteAt(fraction)[token]).toMatch(HEX);
      }
    }
    expect(paletteAt(-1)).toEqual(paletteAt(0));
    expect(paletteAt(2)).toEqual(paletteAt(1));
  });
});

describe('lightAt', () => {
  it('is additive and fully haloed from dusk to the end of the night', () => {
    for (const fraction of [0, 0.25, 0.4, 0.6]) {
      expect(lightAt(fraction)).toEqual({ additive: true, haloAlpha: 1 });
    }
  });

  it('is normal blending with half the halo at full day', () => {
    expect(lightAt(1)).toEqual({ additive: false, haloAlpha: 0.5 });
  });

  it('switches off additive blending exactly once over [0, 1]', () => {
    let switches = 0;
    let previous = lightAt(0).additive;
    for (let step = 1; step <= 1000; step += 1) {
      const { additive } = lightAt(step / 1000);
      if (additive !== previous) {
        switches += 1;
      }
      previous = additive;
    }

    expect(switches).toBe(1);
    expect(previous).toBe(false);
  });

  it('fades the halo between night and day without going up', () => {
    const halos = Array.from({ length: 101 }, (_, step) => lightAt(step / 100).haloAlpha);

    expect(halos.every((halo, index) => halo <= (halos[index - 1] ?? 1))).toBe(true);
    expect(lightAt(0.8).haloAlpha).toBeCloseTo(0.75, 10);
  });
});

describe('relativeLuminance', () => {
  it('follows the WCAG definition', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6);
    expect(relativeLuminance('#808080')).toBeCloseTo(0.2159, 4);
  });
});

describe('sandAt', () => {
  it('lands on the sand of each moment and mixes between them', () => {
    expect(sandAt(0)).toEqual(SAND_PALETTES.crepuscule);
    expect(sandAt(0.4)).toEqual(SAND_PALETTES.nuit);
    expect(sandAt(1)).toEqual(SAND_PALETTES.jour);
    expect(sandAt(0.725).sable).not.toBe(SAND_PALETTES.nuit.sable);
    expect(sandAt(0.725).sable).not.toBe(SAND_PALETTES.aube.sable);
  });
});

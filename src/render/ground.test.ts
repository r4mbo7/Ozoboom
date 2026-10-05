import { describe, expect, it } from 'vitest';
import { paletteAt } from '../shared/palette';
import { MASK_BODY, MARK, maskTone } from './face-kit';
import { LAKE_SKY_MIX, SOL_CLAIR_SHARE, TREE_COUNT, layoutGround, shoreAt } from './ground-layout';
import { MAX_FIREFLIES, contrast, firefliesAt, mixColor, shadowAt } from './ground-sun';
import { createPixiPalette, writePixiPalette } from './palette';

const ARENA = { width: 1600, height: 1000 };
const MOMENTS = [
  ['crepuscule', 0],
  ['nuit', 0.4],
  ['aube', 0.85],
  ['jour', 1],
] as const;

function pixiPaletteAt(fraction: number) {
  const palette = createPixiPalette();
  writePixiPalette(palette, paletteAt(fraction));
  return palette;
}

describe('shadows of the trees', () => {
  it('fall east and long at dusk, as the sun sets in the west', () => {
    const shadow = shadowAt(0);

    expect(Math.cos(shadow.angle)).toBeGreaterThan(0.9);
    expect(shadow.length).toBeGreaterThan(2);
    expect(shadow.alpha).toBeGreaterThan(0.2);
  });

  it('are absent at night', () => {
    const shadow = shadowAt(0.4);

    expect(shadow.length).toBe(0);
    expect(shadow.alpha).toBe(0);
  });

  it('fall west and long at dawn, as the sun rises in the east', () => {
    const shadow = shadowAt(0.85);

    expect(Math.cos(shadow.angle)).toBeLessThan(-0.9);
    expect(shadow.length).toBeGreaterThan(2);
  });

  it('are short and fall to the north at noon', () => {
    const shadow = shadowAt(1);

    expect(Math.sin(shadow.angle)).toBeLessThan(-0.99);
    expect(shadow.length).toBeGreaterThan(0);
    expect(shadow.length).toBeLessThan(shadowAt(0.85).length / 3);
  });

  it('turn and shorten smoothly between dawn and noon', () => {
    const lengths = [0.85, 0.9, 0.95, 1].map((fraction) => shadowAt(fraction).length);

    expect(lengths).toEqual([...lengths].sort((a, b) => b - a));
    expect(shadowAt(0.92).angle).toBeGreaterThan(shadowAt(0.85).angle);
  });
});

describe('fireflies', () => {
  it.each([0, 0.85, 0.9, 1])('are none by day at %s', (fraction) => {
    expect(firefliesAt(fraction, false)).toBe(0);
    expect(firefliesAt(fraction, true)).toBe(0);
  });

  it('fill the night and go out again before the dawn', () => {
    expect(firefliesAt(0.4, false)).toBe(MAX_FIREFLIES);
    expect(firefliesAt(0.7, false)).toBeGreaterThan(0);
    expect(firefliesAt(0.7, false)).toBeLessThan(MAX_FIREFLIES);
  });

  it('are rarer in calm mode', () => {
    expect(firefliesAt(0.4, true)).toBeGreaterThan(0);
    expect(firefliesAt(0.4, true)).toBeLessThan(firefliesAt(0.4, false));
  });
});

describe('layout', () => {
  it('draws the same shore and the same trees for the same seed', () => {
    expect(layoutGround(5, ARENA)).toEqual(layoutGround(5, ARENA));
    expect(layoutGround(6, ARENA).waves).not.toEqual(layoutGround(5, ARENA).waves);
  });

  it('keeps the lake on the left edge and the dance floor dry', () => {
    const layout = layoutGround(5, ARENA);

    for (let y = 0; y <= ARENA.height; y += 50) {
      const edge = shoreAt(layout, y);
      expect(edge).toBeGreaterThan(ARENA.width * 0.1);
      expect(edge).toBeLessThan(ARENA.width * 0.25);
    }
  });

  it.each([1, 5, 99, 123456])(
    'puts ten trees off the lake and off the dance floor, seed %s',
    (seed) => {
      const layout = layoutGround(seed, ARENA);

      expect(layout.trees).toHaveLength(TREE_COUNT);
      for (const tree of layout.trees) {
        const fromCore = Math.hypot(tree.x - ARENA.width / 2, tree.y - ARENA.height / 2);
        expect(fromCore - tree.radius).toBeGreaterThan(layout.floorRadius);
        expect(tree.x - tree.radius).toBeGreaterThan(shoreAt(layout, tree.y));
        expect(tree.x + tree.radius).toBeLessThan(ARENA.width);
        expect(tree.y - tree.radius).toBeGreaterThan(0);
        expect(tree.y + tree.radius).toBeLessThan(ARENA.height);
      }
    },
  );
});

describe('legibility of the bad vibes', () => {
  const FRACTIONS = Array.from({ length: 201 }, (_, index) => index / 200);

  function groundsOf(palette: ReturnType<typeof pixiPaletteAt>) {
    const share = (amount: number) => mixColor(palette.sol, palette.solClair, amount);
    return [
      palette.sol,
      share(SOL_CLAIR_SHARE.lawn),
      share(SOL_CLAIR_SHARE.tufts),
      share(SOL_CLAIR_SHARE.floor),
      mixColor(palette.turquoise, palette.solClair, LAKE_SKY_MIX),
    ];
  }

  it('stand out from every ground at every hour of the set, by their rim or their body', () => {
    const faint: string[] = [];

    for (const fraction of FRACTIONS) {
      const palette = pixiPaletteAt(fraction);
      const rim = palette.badVibeRim;
      const body = maskTone(rim, MASK_BODY);
      for (const ground of groundsOf(palette)) {
        const silhouette = Math.max(contrast(rim, ground), contrast(body, ground));
        if (silhouette < 3) {
          faint.push(`${fraction.toFixed(3)}: ${silhouette.toFixed(2)}:1`);
        }
      }
    }

    expect(faint).toEqual([]);
  });

  it.each(MOMENTS)('show a face that reads on the body at %s', (_moment, fraction) => {
    const rim = pixiPaletteAt(fraction).badVibeRim;

    expect(contrast(maskTone(rim, MARK), maskTone(rim, MASK_BODY))).toBeGreaterThanOrEqual(4.5);
  });
});

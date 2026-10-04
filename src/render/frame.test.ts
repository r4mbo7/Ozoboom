import { describe, expect, it } from 'vitest';
import { SETS } from '../data/sets';
import type { SetDefinition } from '../data/types';
import { lightAt, paletteAt } from '../shared/palette';
import { setFraction } from '../sim/lineup';
import { createFixtureState } from './fixture';
import { pinFraction } from './fixture-time';
import { advanceFrame, createFrame } from './frame';
import { createPixiPalette, writePixiPalette } from './palette';

const [first] = SETS;
if (first === undefined) {
  throw new Error('Missing set');
}
const SET: SetDefinition = first;
const MOMENTS = [
  ['crepuscule', 0],
  ['nuit', 0.4],
  ['aube', 0.85],
  ['jour', 1],
] as const;

function frameAt(fraction: number, alpha = 0) {
  const state = createFixtureState({ enemies: 0, projectiles: 0 });
  state.tick = 4000;
  pinFraction(state, SET, fraction);
  const frame = createFrame();
  advanceFrame(frame, SET, state, alpha);
  return { frame, state };
}

describe('advanceFrame', () => {
  it.each(MOMENTS)('renders the %s palette of the set hour', (_moment, target) => {
    const { frame, state } = frameAt(target);

    const expected = createPixiPalette();
    writePixiPalette(expected, paletteAt(frame.fraction));

    expect(setFraction(SET, state)).toBe(frame.fraction);
    expect(frame.fraction).toBeCloseTo(target, 2);
    expect(frame.palette).toEqual(expected);
    expect(frame.light).toEqual(lightAt(frame.fraction));
  });

  it('follows the tick and its interpolation', () => {
    const { frame, state } = frameAt(0.4, 0.25);

    expect(frame.now).toBe(state.tick + 0.25);
  });

  it('keeps the palette object, rewritten in place, when the hour moves', () => {
    const { frame, state } = frameAt(0);
    const palette = frame.palette;
    const before = palette.sol;

    pinFraction(state, SET, 1);
    advanceFrame(frame, SET, state, 0);

    expect(frame.palette).toBe(palette);
    expect(frame.palette.sol).not.toBe(before);
  });

  it('keeps the bad vibes gray at every hour', () => {
    for (const [, target] of MOMENTS) {
      const { frame } = frameAt(target);
      const color = frame.palette.badVibe;
      const [r, g, b] = [color >> 16, (color >> 8) & 0xff, color & 0xff];

      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(40);
    }
  });
});

import { type Light, lightAt, paletteAt } from '../shared/palette';
import type { SetDefinition } from '../data/types';
import { setFraction } from '../sim/lineup';
import type { SimState } from '../sim/state';
import { type PixiPalette, createPixiPalette, writePixiPalette } from './palette';

// Shared by every family for one image: the hour is computed once, here.
export interface Frame {
  now: number;
  fraction: number;
  palette: PixiPalette;
  light: Light;
  calm: boolean;
  pulse: number;
  flashTick: number;
}

export function createFrame(): Frame {
  return {
    now: 0,
    fraction: Number.NaN,
    palette: createPixiPalette(),
    light: lightAt(0),
    calm: false,
    pulse: 0,
    flashTick: Number.NEGATIVE_INFINITY,
  };
}

export function advanceFrame(frame: Frame, set: SetDefinition, state: SimState, alpha: number) {
  frame.now = state.tick + alpha;
  const fraction = setFraction(set, state);
  if (fraction !== frame.fraction) {
    frame.fraction = fraction;
    writePixiPalette(frame.palette, paletteAt(fraction));
    frame.light = lightAt(fraction);
  }
}

import { MAIN_STAGE } from '../data/sets';
import type { SetDefinition } from '../data/types';
import { type Light, lightAt, paletteAt } from '../shared/palette';
import type { Tempo } from '../shared/tempo';
import { setFraction, setTempo } from '../sim/lineup';
import type { SimState } from '../sim/state';
import { dropFilterIntensity } from './drop-filter';
import { type Camera, frameCamera } from './camera';
import { type PixiPalette, createPixiPalette, writePixiPalette } from './palette';

// Shared by every family for one image: the hour is computed once, here.
export interface Frame {
  now: number;
  set: SetDefinition;
  tempo: Tempo;
  fraction: number;
  palette: PixiPalette;
  light: Light;
  calm: boolean;
  pulse: number;
  flashTick: number;
  dropFilter: number;
  groundFilter: number;
  camera: Camera;
  // Canvas pixels per CSS pixel.
  resolution: number;
}

export function createFrame(set: SetDefinition = MAIN_STAGE): Frame {
  return {
    now: 0,
    set,
    tempo: setTempo(set),
    fraction: Number.NaN,
    palette: createPixiPalette(),
    light: lightAt(0),
    calm: false,
    pulse: 0,
    flashTick: Number.NEGATIVE_INFINITY,
    dropFilter: 0,
    groundFilter: 0,
    camera: frameCamera({ x: 0, y: 0 }, { width: 0, height: 0 }, 0, 0),
    resolution: 1,
  };
}

export function advanceFrame(frame: Frame, set: SetDefinition, state: SimState, alpha: number) {
  frame.now = state.tick + alpha;
  if (set !== frame.set) {
    frame.set = set;
    frame.tempo = setTempo(set);
  }
  frame.dropFilter = dropFilterIntensity(state, frame.now, frame.tempo);
  frame.groundFilter = state.set.tier >= 1 ? frame.dropFilter : 0;
  const fraction = setFraction(set, state);
  if (fraction !== frame.fraction) {
    frame.fraction = fraction;
    writePixiPalette(frame.palette, paletteAt(fraction));
    frame.light = lightAt(fraction);
  }
}

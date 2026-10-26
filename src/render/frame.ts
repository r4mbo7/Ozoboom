import { MAIN_STAGE } from '../data/sets';
import type { SetDefinition } from '../data/types';
import { type Light, lightAt, paletteAt } from '../shared/palette';
import type { Tempo } from '../shared/tempo';
import { playedTempo, setFraction, setTempo } from '../sim/lineup';
import type { EntityId, PlayerId, SimState } from '../sim/state';
import { dropFilterIntensity } from './drop-filter';
import { type Camera, frameCamera } from './camera';
import { type PixiPalette, createPixiPalette, writePixiPalette } from './palette';

export interface Frame {
  now: number;
  // Goes on in real time while the sim waits for a choice or has ended (`ShowClock`).
  show: number;
  set: SetDefinition;
  upcoming: SetDefinition | undefined;
  tempo: Tempo;
  fraction: number;
  palette: PixiPalette;
  light: Light;
  calm: boolean;
  pulse: number;
  flashTick: number;
  // A family that lands a blow sets the tick it lands on, and the scene shakes from it.
  shakeTick: number;
  dropFilter: number;
  groundFilter: number;
  camera: Camera;
  // Canvas pixels per CSS pixel.
  resolution: number;
  // Rewritten every frame by the boss that drains halos; whoever draws a halo reads it.
  drained: { readonly players: Map<PlayerId, number>; readonly traps: Map<EntityId, number> };
  portrait: boolean;
}

export function createFrame(set: SetDefinition = MAIN_STAGE): Frame {
  return {
    now: 0,
    show: 0,
    set,
    upcoming: undefined,
    tempo: setTempo(set),
    fraction: Number.NaN,
    palette: createPixiPalette(),
    light: lightAt(0),
    calm: false,
    pulse: 0,
    flashTick: Number.NEGATIVE_INFINITY,
    shakeTick: Number.NEGATIVE_INFINITY,
    dropFilter: 0,
    groundFilter: 0,
    camera: frameCamera({ x: 0, y: 0 }, { width: 0, height: 0 }, 0, 0),
    resolution: 1,
    drained: { players: new Map(), traps: new Map() },
    portrait: false,
  };
}

export function advanceFrame(
  frame: Frame,
  set: SetDefinition,
  state: SimState,
  alpha: number,
  upcoming?: SetDefinition,
  // An inset is lit at the hour of the game it is shown over.
  fraction = setFraction(set, state),
) {
  frame.now = state.tick + alpha;
  frame.set = set;
  frame.upcoming = upcoming;
  frame.tempo = playedTempo(set, state);
  frame.dropFilter = dropFilterIntensity(state, frame.now, frame.tempo);
  frame.groundFilter = state.set.tier >= 1 ? frame.dropFilter : 0;
  if (fraction !== frame.fraction) {
    frame.fraction = fraction;
    writePixiPalette(frame.palette, paletteAt(fraction));
    frame.light = lightAt(fraction);
  }
}

export function decorSet(
  frame: Pick<Frame, 'set' | 'upcoming'>,
  decor: string,
): SetDefinition | undefined {
  if (frame.set.decor === decor) {
    return frame.set;
  }
  return frame.upcoming?.decor === decor ? frame.upcoming : undefined;
}

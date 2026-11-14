import type { Graphics, Sprite } from 'pixi.js';
import type { Frame } from './frame';
import { easeOutCubic } from './motion';
import type { Textures } from './textures';
import { setTint } from './util';

// What the bomb, the twin vibes and the Batterie share: a halo of their color, a ring and a lift on their carrier,
// a ring spread from their taker.
const CARRIER_HALO = 2.6;
const CARRIER_GAP = 7;
const TAKEN = { bars: 1, from: 18, to: 96, line: 5 };

export interface CarrierMarks {
  readonly halo: Sprite;
  readonly ring: Sprite;
}

export function placeHalo(
  textures: Pick<Textures, 'halo'>,
  halo: Sprite,
  x: number,
  y: number,
  radius: number,
  tint: number,
): void {
  halo.visible = true;
  setTint(halo, tint);
  halo.position.set(x, y);
  halo.scale.set(radius / textures.halo.radius);
}

// The carrier's halo and ring; returns where the bonus floats above it, `lift` past its edge and higher on the beat.
export function placeCarrierMarks(
  textures: Pick<Textures, 'halo' | 'ring'>,
  view: CarrierMarks,
  x: number,
  y: number,
  radius: number,
  lift: number,
  tint: number,
  frame: Frame,
): number {
  const beat = frame.calm ? 0 : frame.pulse;
  placeHalo(textures, view.halo, x, y, radius * CARRIER_HALO, tint);
  view.halo.alpha = frame.light.haloAlpha;
  view.ring.visible = true;
  setTint(view.ring, tint);
  view.ring.position.set(x, y);
  view.ring.scale.set((radius + CARRIER_GAP) / textures.ring.radius);
  view.ring.alpha = 0.85 + 0.15 * beat;
  return y - (radius + lift + 3 * beat);
}

// The ring spread from where a bonus was taken, `since` ticks ago; false once it is over.
export function drawTakeRing(
  rings: Graphics,
  x: number,
  y: number,
  since: number,
  tint: number,
  frame: Frame,
): boolean {
  const share = since / (TAKEN.bars * frame.tempo.ticksPerBar);
  if (share >= 1) {
    return false;
  }
  if (share >= 0) {
    const radius = TAKEN.from + (TAKEN.to - TAKEN.from) * easeOutCubic(share);
    rings.circle(x, y, radius).stroke({ width: TAKEN.line, color: tint, alpha: 1 - share });
  }
  return true;
}

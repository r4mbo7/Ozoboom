import { Rectangle, type Sprite, Texture } from 'pixi.js';
import { clamp } from '../shared/scalar';

type Part = 'above' | 'below';

const STEPS = 48;
const cuts = new WeakMap<Texture, Map<number, Texture>>();

function cutTexture(full: Texture, step: number, part: Part): Texture {
  let byStep = cuts.get(full);
  if (byStep === undefined) {
    byStep = new Map();
    cuts.set(full, byStep);
  }
  const key = part === 'above' ? step : -step;
  let texture = byStep.get(key);
  if (texture === undefined) {
    const { x, y, width, height } = full.frame;
    const line = (height * step) / STEPS;
    const frame =
      part === 'above'
        ? new Rectangle(x, y, width, line)
        : new Rectangle(x, y + line, width, height - line);
    texture = new Texture({ source: full.source, frame });
    byStep.set(key, texture);
  }
  return texture;
}

// The part stands where the whole would; returns the share the cut was rounded to.
export function cutAt(sprite: Sprite, full: Texture, shareFromTop: number, part: Part): number {
  const step = Math.round(clamp(shareFromTop, 1 / STEPS, 1 - 1 / STEPS) * STEPS);
  const share = step / STEPS;
  sprite.texture = cutTexture(full, step, part);
  sprite.anchor.y = part === 'above' ? 0.5 / share : (0.5 - share) / (1 - share);
  return share;
}

export function uncut(sprite: Sprite, full: Texture): void {
  sprite.texture = full;
  sprite.anchor.y = 0.5;
}

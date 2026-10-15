import { type Container, Sprite, type Texture } from 'pixi.js';
import type { Frame } from './frame';
import type { Shape } from './textures';

export function lookup<V>(map: ReadonlyMap<string, V>, key: string, what: string): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`Unknown ${what} "${key}"`);
  }
  return value;
}

export function byId<T extends { readonly id: number }>(
  items: readonly T[],
  id: number,
): T | undefined {
  for (const item of items) {
    if (item.id === id) {
      return item;
    }
  }
  return undefined;
}

export function add(parent: Container, shape: Shape, anchorX = 0.5): Sprite {
  const sprite = new Sprite(shape.texture);
  sprite.anchor.set(anchorX, 0.5);
  parent.addChild(sprite);
  return sprite;
}

export function hide(...sprites: Sprite[]): void {
  for (const sprite of sprites) {
    sprite.visible = false;
  }
}

// Pixi parses the color, allocating, on every tint write, even an unchanged one.
export function setTint(target: { tint: number }, color: number): void {
  if (target.tint !== color) {
    target.tint = color;
  }
}

// By day, what is ours wears a dark outline one logical pixel wide: a copy of the body, grown by it.
export function placeOutline(
  outline: Sprite,
  body: Sprite,
  texture: Texture,
  textureRadius: number,
  frame: Frame,
): void {
  const shown = body.visible && !frame.light.additive;
  outline.visible = shown;
  if (!shown) {
    return;
  }
  const grow = 1 / textureRadius;
  outline.texture = texture;
  setTint(outline, frame.palette.texte);
  outline.position.copyFrom(body.position);
  outline.rotation = body.rotation;
  outline.alpha = body.alpha;
  outline.scale.set(body.scale.x + grow, body.scale.y + grow);
}

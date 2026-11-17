import type { Sprite } from 'pixi.js';
import type { Shadow } from './ground-sun';
import type { LookTextures } from './textures-players';
import { setTint } from './util';

export function placePlayerShadow(
  shadow: Sprite,
  sun: Shadow,
  look: Pick<LookTextures, 'shadow' | 'height'>,
  x: number,
  y: number,
  scale: number,
  lift: number,
): void {
  const reach = sun.length * look.height * 3 + lift * 6 * scale;
  shadow.texture = look.shadow.texture;
  setTint(shadow, 0x000000);
  shadow.alpha = sun.alpha;
  shadow.rotation = sun.angle - Math.PI / 2;
  shadow.position.set(x + Math.cos(sun.angle) * reach, y + Math.sin(sun.angle) * reach);
  const shrink = 1 - 0.14 * lift;
  shadow.scale.set(scale * shrink, scale * (0.85 + 0.1 * sun.length) * shrink);
}

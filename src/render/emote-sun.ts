import type { Sprite } from 'pixi.js';
import { clamp01 } from '../shared/scalar';
import type { RenderContext } from './context';
import { MOCKUP_PIXEL, envelope, sunRay } from './emote-moments';
import type { Frame } from './frame';
import { easeOutCubic } from './motion';
import { TAU, type Shape } from './paint';
import { EMOTE_PLATE, EMOTE_STROKE } from './textures-players-emotes';
import { setTint } from './util';

const SUN_RAYS = 5;
const REFLECTIONS = [
  [3.5, 15],
  [6.5, 10],
  [9.5, 5],
] as const;

type Make = (shape: Shape) => Sprite;

export class EmoteSun {
  private readonly haloRadius: number;
  private readonly plate: Sprite;
  private readonly halo: Sprite;
  private readonly disc: Sprite;
  private readonly horizon: Sprite;
  private readonly rays: readonly Sprite[];
  private readonly reflections: readonly Sprite[];

  constructor(ctx: RenderContext, drawn: Make, glowing: Make) {
    const { textures } = ctx;
    const e = textures.players.emote;
    this.haloRadius = textures.halo.radius;
    this.plate = drawn(e.plate);
    this.halo = glowing(textures.halo);
    this.disc = drawn(e.sun);
    this.horizon = drawn(e.stroke);
    this.rays = Array.from({ length: SUN_RAYS }, () => drawn(e.stroke));
    this.reflections = REFLECTIONS.map(() => drawn(e.stroke));
  }

  place(t: number, x: number, top: number, scale: number, frame: Frame): void {
    const { calm, palette, light } = frame;
    const alpha = envelope(t, 0, 3.9, 0.3, 0.5);
    if (alpha <= 0) {
      return;
    }
    const up = calm ? 1 : easeOutCubic(clamp01(t));
    const size = scale * (calm ? 1 : 0.85 + 0.15 * easeOutCubic(clamp01(t / 0.25)));
    const cy = top - (EMOTE_PLATE + 3) * scale;
    const { plate, halo, disc, horizon, rays, reflections } = this;
    show(plate, x, cy, size, size, palette.sol, 0.82 * alpha);
    show(
      halo,
      x,
      cy,
      (21 * MOCKUP_PIXEL * size) / this.haloRadius,
      NaN,
      palette.noyau,
      light.haloAlpha * alpha,
    );
    show(disc, x, cy, size, size * up, palette.noyau, alpha);
    show(
      horizon,
      x,
      cy,
      ((26 * MOCKUP_PIXEL) / EMOTE_STROKE) * size,
      size * 0.5,
      palette.or,
      alpha,
    );
    rays.forEach((ray, index) => {
      const length = sunRay(index, t, calm);
      if (length < 0.3) {
        return;
      }
      const a = ((-150 + 30 * index) * Math.PI) / 180;
      const middle = (10.5 * MOCKUP_PIXEL + length / 2) * size;
      show(
        ray,
        x + Math.cos(a) * middle,
        cy + Math.sin(a) * middle,
        (length / EMOTE_STROKE) * size,
        size * 0.85,
        palette.or,
        alpha,
      );
      ray.rotation = a;
    });
    reflections.forEach((line, index) => {
      const [below, width] = REFLECTIONS[index] ?? [0, 0];
      const dx = calm ? 0 : Math.sin((t * TAU) / 2 + index) * 1.2 * MOCKUP_PIXEL;
      show(
        line,
        x + dx * size,
        cy + below * MOCKUP_PIXEL * size,
        ((width * MOCKUP_PIXEL) / EMOTE_STROKE) * size,
        size * 0.65,
        palette.turquoise,
        alpha * clamp01(t / 0.6) * (1 - index * 0.15),
      );
    });
  }
}

// NaN as the height scale keeps the sprite round.
export function show(
  sprite: Sprite,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  tint: number,
  alpha: number,
): void {
  sprite.visible = alpha > 0;
  sprite.position.set(x, y);
  sprite.scale.set(scaleX, Number.isNaN(scaleY) ? scaleX : scaleY);
  sprite.rotation = 0;
  setTint(sprite, tint);
  sprite.alpha = alpha;
}

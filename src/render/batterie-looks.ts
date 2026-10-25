import type { Sprite } from 'pixi.js';
import { PEARL } from './batterie-cables';
import { GAUGE, type Point } from './batterie-moments';
import { BOSS_SCALE, FACE_RADIUS } from './face-kit';
import { batterieAPlatFlanks } from './faces-bosses';
import { WHITE, circle, glow, paint, type Shape } from './paint';

const FINE = 2;

export interface MaskAt {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

interface Looks {
  readonly cell: Shape;
  readonly flanks: Shape;
  readonly pearl: Shape;
  readonly calmPearl: Shape;
}

export function paintLooks(): Looks {
  const pearl = (glowing: boolean) =>
    paint(28 * FINE, 28 * FINE, PEARL * FINE, (ctx) => {
      ctx.scale(FINE, FINE);
      if (glowing) {
        glow(ctx, WHITE, 8);
      }
      circle(ctx, PEARL);
      ctx.fillStyle = WHITE;
      ctx.fill();
    });
  return {
    cell: paint(12 * FINE, 12 * FINE, (GAUGE.height / 2) * FINE, (ctx) => {
      ctx.scale(FINE, FINE);
      ctx.beginPath();
      ctx.roundRect(-GAUGE.width / 2, -GAUGE.height / 2, GAUGE.width, GAUGE.height, 2);
      ctx.fillStyle = WHITE;
      ctx.fill();
    }),
    flanks: paint(144 * FINE, 144 * FINE, FACE_RADIUS * FINE, (ctx) => {
      ctx.scale(FINE, FINE);
      batterieAPlatFlanks(ctx);
    }),
    pearl: pearl(true),
    calmPearl: pearl(false),
  };
}

export function pointOnMask(at: MaskAt, [ox, oy]: Point): Point {
  const dx = ox * BOSS_SCALE * at.scaleX;
  const dy = oy * BOSS_SCALE * at.scaleY;
  const cos = Math.cos(at.rotation);
  const sin = Math.sin(at.rotation);
  return [at.x + dx * cos - dy * sin, at.y + dx * sin + dy * cos];
}

export function onMask(sprite: Sprite, at: MaskAt, ox: number, oy: number): void {
  const [x, y] = pointOnMask(at, [ox, oy]);
  sprite.visible = true;
  sprite.position.set(x, y);
  sprite.rotation = at.rotation;
  sprite.scale.set((at.scaleX * BOSS_SCALE) / FINE, (at.scaleY * BOSS_SCALE) / FINE);
}

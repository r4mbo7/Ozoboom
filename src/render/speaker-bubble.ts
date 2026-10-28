import type { Graphics } from 'pixi.js';
import { WHITE, paint, polygon, type Shape } from './paint';

export const CORNER = 12;
export const TAIL_HALF = 6;
export const TAIL = 7;
const VOLUME_RADIUS = 10;

// The bubble's body from (0, 0) to (width, height), its tail out of the bottom edge, or the top
// one when it hangs below its speaker, with its tip at `tipX`.
export function bubble(
  g: Graphics,
  width: number,
  height: number,
  tipX: number,
  below: boolean,
): void {
  g.moveTo(CORNER, 0);
  if (below) {
    g.lineTo(tipX - TAIL_HALF, 0)
      .lineTo(tipX, -TAIL)
      .lineTo(tipX + TAIL_HALF, 0);
  }
  g.arcTo(width, 0, width, height, CORNER).arcTo(width, height, 0, height, CORNER);
  if (!below) {
    g.lineTo(tipX + TAIL_HALF, height)
      .lineTo(tipX, height + TAIL)
      .lineTo(tipX - TAIL_HALF, height);
  }
  g.arcTo(0, height, 0, 0, CORNER).arcTo(0, 0, width, 0, CORNER).closePath();
}

// A small loudspeaker and its two sound arcs, white, tinted with the speaker's color.
export function paintVolume(): Shape {
  const r = VOLUME_RADIUS;
  return paint(
    r * 2 + 4,
    r * 2 + 4,
    r,
    (ctx) => {
      ctx.fillStyle = WHITE;
      ctx.strokeStyle = WHITE;
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.8;
      polygon(ctx, [
        [-9, -3],
        [-5, -3],
        [0, -8],
        [0, 8],
        [-5, 3],
        [-9, 3],
      ]);
      ctx.fill();
      for (const radius of [4.5, 8.5]) {
        ctx.beginPath();
        ctx.arc(1, 0, radius, -0.8, 0.8);
        ctx.stroke();
      }
    },
    2,
  );
}

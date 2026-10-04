import { SHADE_DEEP, WHITE, circle, doubleStroke, glow, paint, type Shape } from './paint';

export interface SpeakerShapes {
  readonly stack: Shape;
  readonly zone: Shape;
}

function cabinet(ctx: CanvasRenderingContext2D, top: number, half: number, height: number): void {
  ctx.beginPath();
  ctx.roundRect(-half, top, half * 2, height, 5);
  ctx.fillStyle = SHADE_DEEP;
  ctx.fill();
  doubleStroke(ctx, 6, 2.2);
}

export function createSpeakerShapes(): SpeakerShapes {
  return {
    stack: paint(96, 128, 32, (ctx) => {
      glow(ctx, WHITE, 8);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = WHITE;
      cabinet(ctx, 2, 26, 56);
      cabinet(ctx, -56, 20, 50);
      for (const [radius, y] of [
        [12, 30],
        [8, -31],
      ] as const) {
        circle(ctx, radius, 0, y);
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.fillStyle = WHITE;
        circle(ctx, radius * 0.3, 0, y);
        ctx.fill();
      }
    }),
    zone: paint(128, 128, 56, (ctx) => {
      ctx.lineCap = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = WHITE;
      ctx.setLineDash([2, 11]);
      circle(ctx, 56);
      ctx.stroke();
    }),
  };
}

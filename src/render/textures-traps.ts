import { SHADE_DEEP, WHITE, circle, glow, paint, polygon, star, type Shape } from './paint';
import type { TrapLook } from './textures';

export function trap(look: TrapLook): Shape {
  const r = 32;
  const color = WHITE;
  return paint(r * 3, r * 3, r, (ctx) => {
    glow(ctx, color, 10);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = color;
    ctx.fillStyle = SHADE_DEEP;
    switch (look) {
      case 'shockwave':
        ctx.beginPath();
        ctx.roundRect(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8, r * 0.2);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 4;
        circle(ctx, r * 0.5);
        ctx.stroke();
        break;
      case 'beam':
        ctx.fillStyle = color;
        ctx.fillRect(r * 0.3, -r * 0.2, r * 0.75, r * 0.4);
        ctx.fillStyle = SHADE_DEEP;
        circle(ctx, r * 0.68);
        ctx.fill();
        ctx.stroke();
        break;
      case 'mist':
        for (const [x, y] of [
          [-r * 0.4, r * 0.15],
          [r * 0.4, r * 0.15],
          [0, -r * 0.3],
        ] as const) {
          circle(ctx, r * 0.5, x, y);
          ctx.fill();
          ctx.stroke();
        }
        break;
      case 'lure':
        polygon(ctx, [
          [0, -r],
          [r * 0.87, r * 0.5],
          [-r * 0.87, r * 0.5],
        ]);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 2;
        polygon(ctx, [
          [0, r * 0.5],
          [r * 0.43, -r * 0.25],
          [-r * 0.43, -r * 0.25],
        ]);
        ctx.stroke();
        break;
      case 'strobe':
        star(ctx, 8, r, r * 0.45);
        ctx.fill();
        ctx.stroke();
        break;
    }
    ctx.fillStyle = WHITE;
    circle(ctx, r * 0.16);
    ctx.fill();
  });
}

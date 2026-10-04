import type { EnemyBehaviour } from '../data/types';
import { SHADE_DEEP, SHADE_SOFT, WHITE, circle, paint, polygon, star, type Shape } from './paint';

const ENEMY_PATHS: Readonly<
  Record<EnemyBehaviour, (ctx: CanvasRenderingContext2D, r: number) => void>
> = {
  horde: (ctx, r) => {
    circle(ctx, r);
  },
  rusher: (ctx, r) => {
    polygon(ctx, [
      [r * 1.2, 0],
      [-r * 0.8, -r * 0.9],
      [-r * 0.8, r * 0.9],
    ]);
  },
  heavy: (ctx, r) => {
    ctx.beginPath();
    ctx.roundRect(-r * 0.88, -r * 0.88, r * 1.76, r * 1.76, r * 0.12);
  },
  shooter: (ctx, r) => {
    polygon(ctx, [
      [0, -r * 1.2],
      [r * 0.8, 0],
      [0, r * 1.2],
      [-r * 0.8, 0],
    ]);
  },
  boss: (ctx, r) => {
    star(ctx, 10, r, r * 0.74);
  },
};

export function enemy(behaviour: EnemyBehaviour): Shape {
  const r = behaviour === 'boss' ? 64 : 32;
  const size = r * 4;
  return paint(size, size, r, (ctx) => {
    const path = ENEMY_PATHS[behaviour];
    path(ctx, r);
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = r * 0.14;
    ctx.strokeStyle = SHADE_DEEP;
    ctx.stroke();

    ctx.save();
    ctx.scale(0.4, 0.4);
    path(ctx, r);
    ctx.restore();
    ctx.fillStyle = SHADE_SOFT;
    ctx.fill();

    if (behaviour === 'boss') {
      circle(ctx, r * 0.3);
      ctx.fillStyle = SHADE_DEEP;
      ctx.fill();
    }
  });
}

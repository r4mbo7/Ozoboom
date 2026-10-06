import { WHITE, paint, polygon, type Shape } from './paint';

export interface ClassFxTextures {
  readonly trail: Shape;
}

export const TRAIL_HALF_LENGTH = 64;

export function createClassFxTextures(): ClassFxTextures {
  return {
    // A comet lying along +x: transparent at the tail, solid at the head.
    trail: paint(TRAIL_HALF_LENGTH * 2, 32, TRAIL_HALF_LENGTH, (ctx) => {
      const gradient = ctx.createLinearGradient(-TRAIL_HALF_LENGTH, 0, TRAIL_HALF_LENGTH, 0);
      gradient.addColorStop(0, 'rgb(255 255 255 / 0)');
      gradient.addColorStop(1, WHITE);
      ctx.fillStyle = gradient;
      polygon(ctx, [
        [-TRAIL_HALF_LENGTH, 0],
        [TRAIL_HALF_LENGTH - 6, -14],
        [TRAIL_HALF_LENGTH, 0],
        [TRAIL_HALF_LENGTH - 6, 14],
      ]);
      ctx.fill();
    }),
  };
}

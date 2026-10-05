import { TAU, WHITE, circle, doubleStroke, glow, paint, polygon, type Shape } from './paint';

export interface ClassFxTextures {
  readonly barrier: Shape;
  readonly disc: Shape;
  readonly trail: Shape;
}

export const BARRIER_RADIUS = 60;
export const TRAIL_HALF_LENGTH = 64;

export function createClassFxTextures(): ClassFxTextures {
  return {
    // The flight case wall: a double thin circle with a hexagon of sacred geometry inside.
    barrier: paint(160, 160, BARRIER_RADIUS, (ctx) => {
      glow(ctx, WHITE, 8);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = WHITE;
      circle(ctx, BARRIER_RADIUS);
      doubleStroke(ctx, 6, 2.4);
      polygon(
        ctx,
        Array.from({ length: 6 }, (_, index) => {
          const angle = (index / 6) * TAU - Math.PI / 2;
          return [Math.cos(angle) * 38, Math.sin(angle) * 38] as const;
        }),
      );
      doubleStroke(ctx, 4, 1.6);
    }),
    disc: paint(160, 160, BARRIER_RADIUS, (ctx) => {
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, BARRIER_RADIUS);
      gradient.addColorStop(0, 'rgb(255 255 255 / 0.55)');
      gradient.addColorStop(1, WHITE);
      ctx.fillStyle = gradient;
      circle(ctx, BARRIER_RADIUS);
      ctx.fill();
    }),
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

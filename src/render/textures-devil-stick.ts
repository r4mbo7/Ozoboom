import { WHITE, glow, paint, type Ctx, type Shape } from './paint';
import { OUT } from './totem-face';

// The devil stick as Constantin chose it (reviews of 2026-10-28): a slim LED devil stick held
// against the chest, a dark rod with a thin white rim and two small tips lit from inside, light
// enough to live beside two more agrès. Its spark is a long exposure of that LED: a white head and
// a trail the class tints. Like the diabolo, the stick keeps its own colours at every moment.
export interface DevilStickTextures {
  readonly stick: Shape;
  readonly sparkHead: Shape;
  readonly sparkTrail: Shape;
  readonly nick: Shape;
}

const STICK_RADIUS = 32;
const ROD_HALF = 28;
const TIP = 0.22;
export const SPARK_TRAIL_LENGTH = 64;
const MAGE = '#ff6fa8';

function rod(ctx: Ctx, from: number, to: number): void {
  ctx.beginPath();
  ctx.moveTo(from, 0);
  ctx.lineTo(to, 0);
}

function strokes(
  ctx: Ctx,
  from: number,
  to: number,
  layers: readonly (readonly [string, number])[],
) {
  for (const [style, width] of layers) {
    rod(ctx, from, to);
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

export function createDevilStickTextures(): DevilStickTextures {
  return {
    stick: paint(STICK_RADIUS * 2 + 8, 24, STICK_RADIUS, (ctx) => {
      ctx.lineCap = 'round';
      strokes(ctx, -ROD_HALF, ROD_HALF, [
        [OUT, 7.6],
        ['rgb(255 255 255 / 0.85)', 5.3],
        ['#1c1530', 2.9],
      ]);
      ctx.save();
      glow(ctx, MAGE, 6);
      for (const side of [-1, 1]) {
        const end = side * ROD_HALF;
        strokes(ctx, end, end * (1 - TIP), [
          [MAGE, 5],
          ['rgb(255 244 250 / 0.75)', 1.8],
        ]);
      }
      ctx.restore();
    }),
    sparkHead: paint(32, 16, 12, (ctx) => {
      glow(ctx, WHITE, 4);
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }),
    sparkTrail: paint(SPARK_TRAIL_LENGTH, 8, 8, (ctx) => {
      const fade = ctx.createLinearGradient(-SPARK_TRAIL_LENGTH / 2, 0, SPARK_TRAIL_LENGTH / 2, 0);
      fade.addColorStop(0, 'rgb(255 255 255 / 0)');
      fade.addColorStop(1, WHITE);
      ctx.fillStyle = fade;
      ctx.beginPath();
      ctx.moveTo(-SPARK_TRAIL_LENGTH / 2, -0.5);
      ctx.lineTo(SPARK_TRAIL_LENGTH / 2, -2.5);
      ctx.lineTo(SPARK_TRAIL_LENGTH / 2, 2.5);
      ctx.lineTo(-SPARK_TRAIL_LENGTH / 2, 0.5);
      ctx.closePath();
      ctx.fill();
    }),
    nick: paint(24, 24, 8, (ctx) => {
      ctx.lineCap = 'round';
      strokes(ctx, -7, 7, [
        [OUT, 5],
        [WHITE, 2.5],
      ]);
    }),
  };
}

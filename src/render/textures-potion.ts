import { WHITE, circle, paint, type Ctx, type Shape } from './paint';

// Never tinted; the glass goes behind the flask's colour waves, the shine in front of them.
export const POTION_BELLY = { y: 5, radius: 13 } as const;
const POTION_NECK = { half: 3.3, top: -13.5 } as const;
const POTION_INK = '#1b0838';
const POTION_GLASS = '#2a1250';
const POTION_RIM = '#fbe9ff';

function flaskPath(ctx: Ctx): void {
  const { y, radius } = POTION_BELLY;
  const { half, top } = POTION_NECK;
  const joint = y - Math.sqrt(radius * radius - half * half);
  ctx.beginPath();
  ctx.moveTo(-half, top);
  ctx.lineTo(-half, joint);
  ctx.arc(0, y, radius, Math.atan2(joint - y, -half), Math.atan2(joint - y, half), true);
  ctx.lineTo(half, top);
  ctx.closePath();
}

export function potion(density: number): Shape {
  return paint(
    48,
    48,
    17,
    (ctx) => {
      ctx.fillStyle = POTION_GLASS;
      ctx.strokeStyle = POTION_INK;
      ctx.lineWidth = 1.8;
      flaskPath(ctx);
      ctx.fill();
      ctx.stroke();
    },
    density,
  );
}

export function potionShine(density: number): Shape {
  return paint(
    48,
    48,
    17,
    (ctx) => {
      const { y, radius } = POTION_BELLY;
      const { half, top } = POTION_NECK;
      const joint = y - Math.sqrt(radius * radius - half * half);
      const depth = ctx.createRadialGradient(-4, y - 4, 4, 0, y, radius + 1);
      depth.addColorStop(0, 'rgb(20 4 40 / 0)');
      depth.addColorStop(0.7, 'rgb(20 4 40 / 0)');
      depth.addColorStop(1, 'rgb(20 4 40 / 0.55)');
      ctx.fillStyle = depth;
      circle(ctx, radius, 0, y);
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = WHITE;
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(0, y, radius - 2.6, Math.PI * 1.05, Math.PI * 1.38);
      ctx.stroke();
      ctx.fillStyle = WHITE;
      circle(ctx, 0.9, 5.4, y - 6.2);
      ctx.fill();
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-half + 1.1, top + 1.5);
      ctx.lineTo(-half + 1.1, joint + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = POTION_RIM;
      ctx.lineWidth = 0.5;
      flaskPath(ctx);
      ctx.stroke();
      ctx.strokeStyle = POTION_INK;
      ctx.lineWidth = 0.7;
      ctx.fillStyle = POTION_RIM;
      ctx.beginPath();
      ctx.roundRect(-half - 1, top - 0.6, 2 * half + 2, 2, 1);
      ctx.fill();
      ctx.stroke();
      const cork = ctx.createLinearGradient(-half, 0, half, 0);
      cork.addColorStop(0, '#ffd6ec');
      cork.addColorStop(1, '#e48ac2');
      ctx.fillStyle = cork;
      ctx.beginPath();
      ctx.roundRect(-half + 0.5, top - 5.2, 2 * half - 1, 5.2, [2.6, 2.6, 0.6, 0.6]);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = WHITE;
      circle(ctx, 0.6, -0.9, top - 3.6);
      ctx.fill();
    },
    density,
  );
}

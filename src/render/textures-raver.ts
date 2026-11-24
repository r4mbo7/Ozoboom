import {
  SHADE_DEEP,
  TAU,
  WHITE,
  circle,
  glow,
  paint,
  polygon,
  type Ctx,
  type Shape,
} from './paint';

export interface RaverTextures {
  // The healer cross emptied from the top: step 0 is an empty shell, CROSS_STEPS a full cross.
  readonly crossClock: readonly Shape[];
  readonly crossShard: Shape;
  readonly bead: Shape;
  readonly mote: Shape;
  readonly ink: Shape;
  readonly heart: Shape;
  readonly heartHalves: readonly [Shape, Shape];
}

export const CROSS_STEPS = 16;
const CROSS_ARM = 13;
const ARM = 4.5;
export const CROSS: readonly (readonly [number, number])[] = [
  [-ARM, -CROSS_ARM],
  [ARM, -CROSS_ARM],
  [ARM, -ARM],
  [CROSS_ARM, -ARM],
  [CROSS_ARM, ARM],
  [ARM, ARM],
  [ARM, CROSS_ARM],
  [-ARM, CROSS_ARM],
  [-ARM, ARM],
  [-CROSS_ARM, ARM],
  [-CROSS_ARM, -ARM],
  [-ARM, -ARM],
];
// The centre of each square of the cross, in its own units: top, right, bottom, left, middle.
export const CROSS_SQUARES: readonly (readonly [number, number])[] = [
  [0, -2 * ARM],
  [2 * ARM, 0],
  [0, 2 * ARM],
  [-2 * ARM, 0],
  [0, 0],
];
// The ink blot's lobes, long and short in turn, and the drops thrown around it, fixed so every
// splash reads the same.
const INK_LOBES = [22, 15, 24, 16, 20, 14, 25, 15, 21, 16, 23, 14, 19, 15];
const INK_DROPS = [
  [0.4, 34, 3],
  [1.3, 31, 2.2],
  [2.2, 36, 3.4],
  [3.1, 30, 2],
  [3.9, 35, 2.8],
  [4.8, 32, 2.4],
  [5.7, 37, 3],
] as const;
const HEART_SIZE = 9;
// The crack down the middle of a heart, top to bottom.
const CRACK = [
  [0.4, -6],
  [-1.6, -2.2],
  [1.4, 1.1],
  [-1.1, 4.3],
  [0, 7],
] as const;

function crossClockTexture(step: number): Shape {
  return paint(40, 40, 14, (ctx) => {
    ctx.lineJoin = 'round';
    polygon(ctx, CROSS);
    ctx.fillStyle = 'rgb(4 6 18 / 0.85)';
    ctx.fill();
    ctx.fillStyle = 'rgb(255 255 255 / 0.16)';
    ctx.fill();
    if (step > 0) {
      const height = (2 * CROSS_ARM * step) / CROSS_STEPS;
      ctx.save();
      ctx.beginPath();
      ctx.rect(-CROSS_ARM - 1, CROSS_ARM - height, 2 * CROSS_ARM + 2, height + 1);
      ctx.clip();
      polygon(ctx, CROSS);
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.restore();
    }
    polygon(ctx, CROSS);
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = SHADE_DEEP;
    ctx.stroke();
    // A healer line inside the dark rim keeps the emptied part readable as a cross.
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgb(255 255 255 / 0.75)';
    ctx.stroke();
  });
}

function heartPath(ctx: Ctx): void {
  const k = HEART_SIZE / 9;
  ctx.beginPath();
  ctx.moveTo(0, 7 * k);
  ctx.bezierCurveTo(-2 * k, 5 * k, -9 * k, 1 * k, -9 * k, -3 * k);
  ctx.bezierCurveTo(-9 * k, -8 * k, -4 * k, -10 * k, 0, -6 * k);
  ctx.bezierCurveTo(4 * k, -10 * k, 9 * k, -8 * k, 9 * k, -3 * k);
  ctx.bezierCurveTo(9 * k, 1 * k, 2 * k, 5 * k, 0, 7 * k);
  ctx.closePath();
}

function heartTexture(side: -1 | 0 | 1): Shape {
  return paint(28, 28, HEART_SIZE, (ctx) => {
    if (side !== 0) {
      ctx.beginPath();
      ctx.moveTo(side * 12, -12);
      ctx.lineTo(CRACK[0][0], -12);
      for (const [x, y] of CRACK) {
        ctx.lineTo(x, y);
      }
      ctx.lineTo(CRACK[CRACK.length - 1]?.[0] ?? 0, 12);
      ctx.lineTo(side * 12, 12);
      ctx.closePath();
      ctx.clip();
    }
    heartPath(ctx);
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = SHADE_DEEP;
    ctx.stroke();
    if (side !== 0) {
      ctx.beginPath();
      for (const [x, y] of CRACK) {
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

export function createRaverTextures(): RaverTextures {
  return {
    crossClock: Array.from({ length: CROSS_STEPS + 1 }, (_, step) => crossClockTexture(step)),
    crossShard: paint(16, 16, ARM, (ctx) => {
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.rect(-ARM, -ARM, 2 * ARM, 2 * ARM);
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = SHADE_DEEP;
      ctx.stroke();
    }),
    bead: paint(12, 12, 4, (ctx) => {
      circle(ctx, 4);
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = SHADE_DEEP;
      ctx.stroke();
    }),
    mote: paint(24, 24, 4, (ctx) => {
      glow(ctx, WHITE, 6);
      circle(ctx, 4);
      ctx.fillStyle = WHITE;
      ctx.fill();
    }),
    ink: paint(96, 96, 24, (ctx) => {
      const points = INK_LOBES.map((radius, index): [number, number] => {
        const angle = (index / INK_LOBES.length) * TAU;
        return [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.85];
      });
      const mid = (index: number): [number, number] => {
        const [ax, ay] = points[index % points.length] ?? [0, 0];
        const [bx, by] = points[(index + 1) % points.length] ?? [0, 0];
        return [(ax + bx) / 2, (ay + by) / 2];
      };
      ctx.beginPath();
      ctx.moveTo(...mid(0));
      for (let index = 1; index <= points.length; index += 1) {
        const [cx, cy] = points[index % points.length] ?? [0, 0];
        ctx.quadraticCurveTo(cx, cy, ...mid(index));
      }
      ctx.closePath();
      for (const [angle, distance, radius] of INK_DROPS) {
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance * 0.85;
        ctx.moveTo(x + Math.cos(angle) * radius * 1.6, y + Math.sin(angle) * radius * 1.6);
        ctx.ellipse(x, y, radius * 1.6, radius, angle, 0, TAU);
      }
      ctx.fillStyle = WHITE;
      ctx.fill();
    }),
    heart: heartTexture(0),
    heartHalves: [heartTexture(-1), heartTexture(1)],
  };
}

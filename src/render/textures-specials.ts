import { RING_STEPS } from './help';
import {
  SHADE,
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

export interface SpecialTextures {
  readonly zone: Shape;
  readonly cone: Shape;
  readonly link: Shape;
  readonly purse: Shape;
  readonly bubble: Shape;
  readonly bubbleRim: Shape;
  readonly blabla: Shape;
  readonly cross: Shape;
  readonly distress: Shape;
  readonly relieved: Shape;
  readonly helpRing: readonly Shape[];
}

const BUBBLE = { width: 88, height: 46, corner: 12 };

function bubbleOutline(ctx: Ctx): void {
  const { width, height, corner } = BUBBLE;
  ctx.beginPath();
  ctx.roundRect(-width / 2, -height / 2 - 4, width, height, corner);
  ctx.moveTo(-14, height / 2 - 4);
  ctx.lineTo(-22, height / 2 + 10);
  ctx.lineTo(-2, height / 2 - 4);
}

function face(ctx: Ctx, eyes: (side: -1 | 1) => void, mouth: () => void): void {
  circle(ctx, 28);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = SHADE_DEEP;
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = SHADE_DEEP;
  eyes(-1);
  eyes(1);
  mouth();
}

function ringStepTexture(step: number): Shape {
  return paint(64, 64, 26, (ctx) => {
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgb(255 255 255 / 0.22)';
    circle(ctx, 26);
    ctx.stroke();
    if (step > 0) {
      ctx.strokeStyle = WHITE;
      ctx.beginPath();
      ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + (step / RING_STEPS) * TAU);
      ctx.stroke();
    }
  });
}

export function createSpecialTextures(): SpecialTextures {
  return {
    zone: paint(256, 256, 120, (ctx) => {
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 120);
      gradient.addColorStop(0, 'rgb(255 255 255 / 0.55)');
      gradient.addColorStop(0.8, 'rgb(255 255 255 / 0.8)');
      gradient.addColorStop(1, WHITE);
      ctx.fillStyle = gradient;
      circle(ctx, 118);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = WHITE;
      ctx.stroke();
    }),
    cone: paint(160, 112, 160, (ctx) => {
      for (const [spread, alpha] of [
        [0.5, 0.12],
        [0.4, 0.16],
        [0.3, 0.22],
        [0.2, 0.3],
      ] as const) {
        const gradient = ctx.createLinearGradient(-80, 0, 80, 0);
        gradient.addColorStop(0, `rgb(255 255 255 / ${String(alpha * 1.6)})`);
        gradient.addColorStop(1, 'rgb(255 255 255 / 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(-80, 0);
        ctx.lineTo(80, -Math.tan(spread) * 160);
        ctx.lineTo(80, Math.tan(spread) * 160);
        ctx.closePath();
        ctx.fill();
      }
    }),
    link: paint(64, 16, 64, (ctx) => {
      ctx.lineCap = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = WHITE;
      ctx.beginPath();
      ctx.moveTo(-30, 0);
      ctx.lineTo(30, 0);
      ctx.stroke();
    }),
    purse: paint(48, 48, 14, (ctx) => {
      glow(ctx, WHITE, 4);
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.quadraticCurveTo(-16, 4, -10, 12);
      ctx.quadraticCurveTo(0, 17, 10, 12);
      ctx.quadraticCurveTo(16, 4, 6, -8);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = SHADE_DEEP;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-7, -9);
      ctx.quadraticCurveTo(0, -5, 7, -9);
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = SHADE;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 9);
      ctx.moveTo(-4, 2);
      ctx.lineTo(4, 2);
      ctx.stroke();
    }),
    bubble: paint(112, 76, 44, (ctx) => {
      ctx.fillStyle = WHITE;
      bubbleOutline(ctx);
      ctx.fill();
    }),
    bubbleRim: paint(112, 76, 44, (ctx) => {
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = WHITE;
      bubbleOutline(ctx);
      ctx.stroke();
    }),
    blabla: paint(112, 76, 44, (ctx) => {
      ctx.fillStyle = WHITE;
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('bla bla', 0, -4);
    }),
    cross: paint(40, 40, 14, (ctx) => {
      ctx.lineJoin = 'round';
      polygon(ctx, [
        [-4.5, -13],
        [4.5, -13],
        [4.5, -4.5],
        [13, -4.5],
        [13, 4.5],
        [4.5, 4.5],
        [4.5, 13],
        [-4.5, 13],
        [-4.5, 4.5],
        [-13, 4.5],
        [-13, -4.5],
        [-4.5, -4.5],
      ]);
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = SHADE_DEEP;
      ctx.stroke();
    }),
    distress: paint(80, 80, 28, (ctx) => {
      face(
        ctx,
        (side) => {
          ctx.beginPath();
          ctx.arc(side * 10, 1, 3.2, 0, TAU);
          ctx.fillStyle = SHADE_DEEP;
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(side * 4, -12);
          ctx.lineTo(side * 15, -8);
          ctx.stroke();
        },
        () => {
          ctx.beginPath();
          ctx.ellipse(0, 13, 4.5, 3.5, 0, 0, TAU);
          ctx.fillStyle = SHADE;
          ctx.fill();
        },
      );
    }),
    relieved: paint(80, 80, 28, (ctx) => {
      face(
        ctx,
        (side) => {
          ctx.beginPath();
          ctx.arc(side * 10, 2, 5, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        },
        () => {
          ctx.beginPath();
          ctx.arc(0, 4, 13, Math.PI * 0.2, Math.PI * 0.8);
          ctx.stroke();
        },
      );
    }),
    helpRing: Array.from({ length: RING_STEPS + 1 }, (_, step) => ringStepTexture(step)),
  };
}

export function specialShapes(textures: SpecialTextures): Shape[] {
  const { helpRing, ...single } = textures;
  return [...Object.values(single), ...helpRing];
}

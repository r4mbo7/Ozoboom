import { TAU, WHITE, type Ctx, type Piece } from './paint';
import { REFERENCE_RADIUS } from './textures-looks';

const BODY = { x: 2, rx: 11, ry: 22 };
export const DOWNED_HEAD = { x: -18, radius: 10 };
const LINE = 3;
export const DOWNED_REACH = BODY.ry + LINE;
const INNER = { inset: 3.5, width: 1.1 };

function silhouette(ctx: Ctx, grow: number): void {
  ctx.beginPath();
  ctx.ellipse(BODY.x, 0, BODY.rx + grow, BODY.ry + grow, 0, 0, TAU);
  ctx.moveTo(DOWNED_HEAD.x + DOWNED_HEAD.radius + grow, 0);
  ctx.arc(DOWNED_HEAD.x, 0, DOWNED_HEAD.radius + grow, 0, TAU);
}

function stroked(grow: number, width: number) {
  return (ctx: Ctx) => {
    silhouette(ctx, grow);
    ctx.lineWidth = width;
    ctx.strokeStyle = WHITE;
    ctx.stroke();
  };
}

export const DOWNED_PIECES = {
  downedFill: [
    128,
    128,
    REFERENCE_RADIUS,
    (ctx) => {
      silhouette(ctx, 0);
      ctx.fillStyle = WHITE;
      ctx.fill();
    },
  ],
  downedLine: [128, 128, REFERENCE_RADIUS, stroked(0, LINE)],
  downedInner: [128, 128, REFERENCE_RADIUS, stroked(-INNER.inset, INNER.width)],
  downedVeil: [
    128,
    128,
    48,
    (ctx) => {
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 48);
      gradient.addColorStop(0, 'rgb(255 255 255 / 0)');
      gradient.addColorStop(0.35, 'rgb(255 255 255 / 0)');
      gradient.addColorStop(1, 'rgb(255 255 255 / 1)');
      ctx.fillStyle = gradient;
      ctx.fillRect(-64, -64, 128, 128);
    },
  ],
  firefly: [
    16,
    16,
    REFERENCE_RADIUS,
    (ctx) => {
      ctx.beginPath();
      ctx.arc(0, 0, 3.4, 0, TAU);
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    },
  ],
} satisfies Record<string, Piece>;

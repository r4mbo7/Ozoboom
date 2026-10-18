import { TAU, WHITE, type Ctx, type Piece } from './paint';
import { REFERENCE } from './textures-looks';

// Every class lies down the same: its body and its head, fallen backwards, the head behind the aim.
const BODY = { x: 2, rx: 11, ry: 22 };
export const DOWNED_HEAD = { x: -18, radius: 10 };
const LINE = 3;
// How far the outline reaches from the player, in reference pixels, whichever way it lies.
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
    REFERENCE,
    (ctx) => {
      silhouette(ctx, 0);
      ctx.fillStyle = WHITE;
      ctx.fill();
    },
  ],
  downedLine: [128, 128, REFERENCE, stroked(0, LINE)],
  downedInner: [128, 128, REFERENCE, stroked(-INNER.inset, INNER.width)],
  // The veil over the world of a downed player: clear in the middle, opaque from its radius to the
  // corners of the square, so that scaled to that radius it covers the whole screen.
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
  // A firefly, white to take the colour of who it watches, ringed in black to show on the sand.
  firefly: [
    16,
    16,
    REFERENCE,
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

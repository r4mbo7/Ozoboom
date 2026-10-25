import { TAU, WHITE, circle, glow, rim } from './paint';
import type { Ctx, Piece } from './paint';
import { REFERENCE_RADIUS } from './textures-looks';

export const UNIT = 2;

export const CREAM = 0xfff6dc;
export const HAIR = 0x3a2618;

export const HANDS = { along: 4, across: 16.5, swing: 2.4 } as const;
export const HEAD = { along: 2, hair: 1.2 } as const;
const COLLAR = { flowers: 10, radius: 9.6, flower: 2.5 } as const;

function units(draw: (ctx: Ctx) => void): (ctx: Ctx) => void {
  return (ctx) => {
    ctx.save();
    ctx.scale(UNIT, UNIT);
    draw(ctx);
    ctx.restore();
  };
}

function torsoPath(ctx: Ctx): void {
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 13, 0, 0, TAU);
}

function torso(ctx: Ctx): void {
  torsoPath(ctx);
  ctx.fillStyle = '#e4e4e4';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(1.5, 0, 4, 8.6, 0, 0, TAU);
  ctx.fillStyle = WHITE;
  ctx.fill();
  torsoPath(ctx);
  rim(ctx, 1.6);
}

function flowers(first: number): (ctx: Ctx) => void {
  return (ctx) => {
    for (let flower = first; flower < COLLAR.flowers; flower += 2) {
      const angle = (flower * TAU) / COLLAR.flowers;
      circle(ctx, COLLAR.flower, Math.cos(angle) * COLLAR.radius, Math.sin(angle) * COLLAR.radius);
      ctx.fillStyle = WHITE;
      ctx.fill();
      rim(ctx, 0.9);
    }
  };
}

function hand(ctx: Ctx): void {
  circle(ctx, 4.4);
  ctx.fillStyle = WHITE;
  ctx.fill();
  rim(ctx, 1.2);
}

function swing(side: number): (ctx: Ctx) => void {
  return (ctx) => {
    ctx.beginPath();
    if (side < 0) {
      ctx.arc(0, 0, 7, -2.4, -1.2);
    } else {
      ctx.arc(0, 0, 7, 1.2, 2.4);
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = WHITE;
    ctx.stroke();
  };
}

function head(ctx: Ctx): void {
  circle(ctx, 7);
  ctx.fillStyle = WHITE;
  ctx.fill();
  rim(ctx, 1.4);
}

function hair(ctx: Ctx): void {
  circle(ctx, 5);
  ctx.fillStyle = WHITE;
  ctx.fill();
}

export const HEART_SIZE = 7;
function heart(ctx: Ctx): void {
  const s = HEART_SIZE;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.95);
  ctx.bezierCurveTo(-s * 1.9, -s * 0.3, -s * 0.9, -s * 1.5, 0, -s * 0.55);
  ctx.bezierCurveTo(s * 0.9, -s * 1.5, s * 1.9, -s * 0.3, 0, s * 0.95);
  ctx.closePath();
  ctx.fillStyle = WHITE;
  ctx.fill();
  rim(ctx, 1.2);
}

function soft(width: number, height: number): Piece {
  return [
    96,
    96,
    REFERENCE_RADIUS,
    (ctx) => {
      glow(ctx, WHITE, 8);
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.ellipse(0, 0, width, height, 0, 0, TAU);
      ctx.fill();
    },
  ];
}

export const KIFFEUR_PIECES = {
  torso: [40, 60, REFERENCE_RADIUS, units(torso)],
  flowersEven: [56, 56, REFERENCE_RADIUS, units(flowers(0))],
  flowersOdd: [56, 56, REFERENCE_RADIUS, units(flowers(1))],
  hand: [24, 24, REFERENCE_RADIUS, units(hand)],
  swingLeft: [40, 40, REFERENCE_RADIUS, units(swing(-1))],
  swingRight: [40, 40, REFERENCE_RADIUS, units(swing(1))],
  head: [32, 32, REFERENCE_RADIUS, units(head)],
  hair: [24, 24, REFERENCE_RADIUS, units(hair)],
  heart: [32, 32, REFERENCE_RADIUS, heart],
  shadow: soft(16, 26),
} satisfies Record<string, Piece>;

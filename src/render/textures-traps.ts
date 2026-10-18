import {
  SHADE_DEEP,
  TAU,
  WHITE,
  circle,
  doubleStroke,
  glow,
  paint,
  polygon,
  star,
  type Ctx,
  type Shape,
} from './paint';
import type { TrapLook } from './textures';

const OUTER = 7;
const GAP = 3;

function outlined(ctx: Ctx): void {
  ctx.fill();
  doubleStroke(ctx, OUTER, GAP);
}

export function trap(look: TrapLook): Shape {
  const r = 32;
  return paint(r * 3, r * 3, r, (ctx) => {
    glow(ctx, WHITE, 10);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = WHITE;
    ctx.fillStyle = SHADE_DEEP;
    switch (look) {
      case 'shockwave':
        ctx.beginPath();
        ctx.roundRect(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8, r * 0.2);
        outlined(ctx);
        circle(ctx, r * 0.52);
        doubleStroke(ctx, 6, 2.5);
        break;
      case 'beam':
        ctx.beginPath();
        ctx.roundRect(-r * 0.9, -r * 0.55, r * 1.2, r * 1.1, r * 0.18);
        outlined(ctx);
        circle(ctx, r * 0.5, r * 0.4, 0);
        outlined(ctx);
        break;
      case 'mist':
        for (const [x, y] of [
          [-r * 0.45, r * 0.2],
          [r * 0.45, r * 0.2],
          [0, -r * 0.35],
        ] as const) {
          circle(ctx, r * 0.5, x, y);
          outlined(ctx);
        }
        break;
      case 'lure':
        polygon(ctx, [
          [0, -r],
          [r * 0.87, r * 0.5],
          [-r * 0.87, r * 0.5],
        ]);
        outlined(ctx);
        polygon(ctx, [
          [0, r * 0.3],
          [r * 0.4, -r * 0.4],
          [-r * 0.4, -r * 0.4],
        ]);
        doubleStroke(ctx, 5, 2);
        break;
      case 'strobe':
        star(ctx, 8, r, r * 0.5);
        outlined(ctx);
        break;
      case 'breeze':
        ctx.beginPath();
        ctx.roundRect(-r * 1.05, -r * 0.42, r * 0.5, r * 0.84, r * 0.14);
        outlined(ctx);
        circle(ctx, r * 0.78);
        outlined(ctx);
        ctx.lineCap = 'round';
        ctx.lineWidth = 5;
        for (let blade = 0; blade < 3; blade += 1) {
          const angle = (blade / 3) * TAU;
          const at = (turn: number, reach: number) =>
            [Math.cos(angle + turn) * r * reach, Math.sin(angle + turn) * r * reach] as const;
          ctx.beginPath();
          ctx.moveTo(...at(0, 0.2));
          ctx.quadraticCurveTo(...at(0.15, 0.5), ...at(0.75, 0.52));
          ctx.stroke();
        }
        break;
    }
    ctx.fillStyle = WHITE;
    circle(ctx, r * 0.16);
    ctx.fill();
  });
}

// A flight case seen from above: a dark body the tint turns turquoise, a light rim and handle,
// and room in the middle for the icon of its trap.
export function crate(): Shape {
  return paint(48, 44, 16, (ctx) => {
    glow(ctx, WHITE, 6);
    ctx.fillStyle = SHADE_DEEP;
    ctx.beginPath();
    ctx.roundRect(-16, -11, 32, 24, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = WHITE;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-6, -16, 12, 5, 2.5);
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const [x, y] of [
      [-16, -11],
      [16, -11],
      [-16, 13],
      [16, 13],
    ] as const) {
      ctx.moveTo(x, y + Math.sign(-y) * 6);
      ctx.lineTo(x, y);
      ctx.lineTo(x - Math.sign(x) * 6, y);
    }
    ctx.stroke();
  });
}

// Where the fuse of `bomb()` ends, in texture pixels from its center: the spark sits there.
export const BOMB_FUSE_TIP = { x: 16, y: -23 } as const;

// A round bomb with a capped fuse, dark inside a light double rim: its shape alone tells it from
// the square flight case of a loot.
export function bomb(): Shape {
  return paint(64, 64, 20, (ctx) => {
    glow(ctx, WHITE, 6);
    ctx.fillStyle = SHADE_DEEP;
    circle(ctx, 14, -2, 5);
    ctx.fill();
    ctx.strokeStyle = WHITE;
    doubleStroke(ctx, 6, 2);
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-2, 5, 8, Math.PI * 1.05, Math.PI * 1.45);
    ctx.stroke();
    ctx.save();
    ctx.translate(8.5, -5.5);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.roundRect(-5, -5, 10, 7, 1.5);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(11, -9);
    ctx.quadraticCurveTo(20, -13, BOMB_FUSE_TIP.x, BOMB_FUSE_TIP.y);
    ctx.stroke();
  });
}

// The cone of the misting fan, painted from its tip on the left at the opening of the data.
export const CONE_LENGTH = 128;
export const CONE_DEGREES = 50;

export function cone(): Shape {
  return paint(CONE_LENGTH, CONE_LENGTH, CONE_LENGTH / 2, (ctx) => {
    const tip = -CONE_LENGTH / 2;
    const half = (CONE_DEGREES * Math.PI) / 360;
    const reach = CONE_LENGTH - 2;
    const mist = ctx.createRadialGradient(tip, 0, 0, tip, 0, reach);
    mist.addColorStop(0, 'rgb(255 255 255 / 0.55)');
    mist.addColorStop(1, 'rgb(255 255 255 / 0.1)');
    ctx.fillStyle = mist;
    ctx.beginPath();
    ctx.moveTo(tip, 0);
    ctx.arc(tip, 0, reach, -half, half);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgb(255 255 255 / 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    for (const side of [-half, half]) {
      ctx.moveTo(tip + Math.cos(side) * 14, Math.sin(side) * 14);
      ctx.lineTo(tip + Math.cos(side) * reach, Math.sin(side) * reach);
    }
    ctx.stroke();
  });
}

export const DROPLET_RADIUS = 3;

export function droplet(): Shape {
  return paint(16, 16, DROPLET_RADIUS, (ctx) => {
    glow(ctx, WHITE, 3);
    ctx.fillStyle = WHITE;
    circle(ctx, DROPLET_RADIUS);
    ctx.fill();
  });
}

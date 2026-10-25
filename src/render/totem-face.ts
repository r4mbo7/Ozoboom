import { TAU, WHITE, circle, glow, type Ctx } from './paint';

// The carved sun face of the Totem: heavy-lidded almond eyes, spirals on the cheeks, full lips.
export const HEAD = 23;

export const OUT = '#141414';
export const WOOD = '#5a2a12';
export const TANK = '#ff9a3d';
export const TANK_DEEP = '#c4621f';
export const TANK_LIGHT = '#ffb565';
export const GOLD = '#ffd27a';
export const OR = '#d9a441';
const IRIS = '#3fd0c9';
const LID = '#f2a43a';
const CARVE = '#d2661f';

export function stroke(ctx: Ctx, color: string, width: number): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function disc(ctx: Ctx, radius: number, color: string | CanvasGradient, x = 0, y = 0): void {
  ctx.fillStyle = color;
  circle(ctx, radius, x, y);
  ctx.fill();
}

function almond(ctx: Ctx, width: number, height: number): void {
  ctx.beginPath();
  ctx.moveTo(-width / 2, 0);
  ctx.quadraticCurveTo(0, -height, width / 2, 0);
  ctx.quadraticCurveTo(0, height, -width / 2, 0);
  ctx.closePath();
}

// An almond eye under a heavy lid, half shut: the face stays serene.
function eye(ctx: Ctx, x: number, y: number): void {
  const width = 9;
  const height = 4.6;
  ctx.save();
  ctx.translate(x, y);
  almond(ctx, width, height);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#fff6df';
  ctx.fill();
  disc(ctx, height * 0.55, IRIS, 0, height * 0.18);
  disc(ctx, height * 0.26, WOOD, 0, height * 0.18);
  const lid = height * 0.25;
  ctx.fillStyle = LID;
  ctx.fillRect(-width, -height * 2, width * 2, height * 2 + lid);
  ctx.beginPath();
  ctx.moveTo(-width / 2, lid);
  ctx.lineTo(width / 2, lid);
  stroke(ctx, WOOD, 1.6);
  ctx.restore();
  almond(ctx, width, height);
  stroke(ctx, WOOD, 1.3);
  ctx.restore();
}

function spiral(ctx: Ctx, x: number, y: number, turn: number): void {
  ctx.beginPath();
  for (let k = 0; k <= 26; k += 1) {
    const q = k / 26;
    const angle = q * TAU * 1.6 * turn;
    const radius = 0.4 + q * 3;
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  stroke(ctx, CARVE, 1.1);
}

// Brows flowing into the nose, eyes, spirals on the cheeks, full lips, the closed third eye.
export function face(ctx: Ctx): void {
  const light = ctx.createRadialGradient(-6, -7, 2, 0, 0, HEAD);
  light.addColorStop(0, '#ffe9a6');
  light.addColorStop(0.6, GOLD);
  light.addColorStop(1, '#f5ac40');
  disc(ctx, HEAD, light);
  stroke(ctx, OUT, 3);
  circle(ctx, HEAD - 3.2);
  stroke(ctx, 'rgb(196 98 31 / 0.55)', 1);
  ctx.save();
  ctx.scale(HEAD / 21, HEAD / 21);
  ctx.beginPath();
  ctx.moveTo(-13, -4.5);
  ctx.quadraticCurveTo(-7.5, -10, -2, -5.5);
  ctx.quadraticCurveTo(-1, 0, -2.2, 4.2);
  ctx.quadraticCurveTo(0, 6.2, 2.2, 4.2);
  ctx.quadraticCurveTo(1, 0, 2, -5.5);
  ctx.quadraticCurveTo(7.5, -10, 13, -4.5);
  stroke(ctx, WOOD, 1.5);
  eye(ctx, -7.2, -2.2);
  eye(ctx, 7.2, -2.2);
  spiral(ctx, -11.5, 6, 1);
  spiral(ctx, 11.5, 6, -1);
  ctx.beginPath();
  ctx.moveTo(-6.5, 10.5);
  ctx.quadraticCurveTo(-3, 7.6, 0, 9);
  ctx.quadraticCurveTo(3, 7.6, 6.5, 10.5);
  ctx.quadraticCurveTo(0, 16.5, -6.5, 10.5);
  ctx.closePath();
  ctx.fillStyle = '#e85a3c';
  ctx.fill();
  stroke(ctx, WOOD, 1.3);
  ctx.beginPath();
  ctx.moveTo(-6.2, 10.6);
  ctx.quadraticCurveTo(0, 12.6, 6.2, 10.6);
  stroke(ctx, WOOD, 1.1);
  const third = -12.2;
  ctx.beginPath();
  ctx.arc(0, third - 1.6, 3.4, 0.2 * Math.PI, 0.8 * Math.PI);
  stroke(ctx, WOOD, 1.3);
  ctx.beginPath();
  ctx.arc(0, third, 6, 1.15 * Math.PI, 1.85 * Math.PI);
  stroke(ctx, CARVE, 1);
  ctx.restore();
}

// The open third eye, laid over the closed one: it opens on the height of its sprite.
export function openEye(ctx: Ctx): void {
  const s = HEAD / 21;
  ctx.scale(s, s);
  glow(ctx, '#fff2c0', 6);
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.2, 3.8, 0, 0, TAU);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.shadowBlur = 0;
  stroke(ctx, WOOD, 1.2);
  disc(ctx, 2.1, IRIS);
  disc(ctx, 1, WOOD);
}

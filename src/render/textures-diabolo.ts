import { WHITE, paint, type Ctx, type Shape } from './paint';
import { OUT } from './totem-face';

// The Diabolo as Constantin chose it (review of 2026-10-28): the LED diabolo of night jugglers,
// two cups of translucent plastic lit from inside, a pinkish white core by the axle, under a dark
// outline and a thin white rim. It keeps its own colours at every moment, like the plates.
const RADIUS = 32;
// The drawing's units: a cup runs from its hub by the axle to its rim, then its mouth.
const HUB = 6;
const RIM = 38;
const HUB_RADIUS = 6.5;
const RIM_RADIUS = 34;
const MOUTH = 6.5;
const UNIT = 30 / (RIM + MOUTH);
const STEPS = 14;
const MAGE = '#ff6fa8';
const CORE = 'rgb(255 244 250 / 0.85)';

const radiusAt = (u: number) => HUB_RADIUS + (RIM_RADIUS - HUB_RADIUS) * Math.pow(u, 1.45);

function cupPath(ctx: Ctx, side: number): void {
  ctx.beginPath();
  for (let i = 0; i <= STEPS; i += 1) {
    ctx.lineTo(side * (HUB + ((RIM - HUB) * i) / STEPS), -radiusAt(i / STEPS));
  }
  ctx.ellipse(side * RIM, 0, MOUTH, RIM_RADIUS, 0, -Math.PI / 2, Math.PI / 2, side < 0);
  for (let i = STEPS; i >= 0; i -= 1) {
    ctx.lineTo(side * (HUB + ((RIM - HUB) * i) / STEPS), radiusAt(i / STEPS));
  }
  ctx.closePath();
}

function cup(ctx: Ctx, side: number): void {
  cupPath(ctx, side);
  const body = ctx.createLinearGradient(0, 0, side * RIM, 0);
  body.addColorStop(0, '#ffc2da');
  body.addColorStop(0.45, MAGE);
  body.addColorStop(1, '#e2427f');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.save();
  cupPath(ctx, side);
  ctx.clip();
  const core = ctx.createRadialGradient(side * HUB, 0, 0, side * HUB, 0, 34);
  core.addColorStop(0, CORE);
  core.addColorStop(0.5, 'rgb(255 200 226 / 0.5)');
  core.addColorStop(1, 'rgb(255 111 168 / 0)');
  ctx.fillStyle = core;
  ctx.fillRect(-RIM - MOUTH, -RIM_RADIUS, 2 * (RIM + MOUTH), 2 * RIM_RADIUS);
  ctx.restore();
  // The mouth, lit from inside, under a thin white rim.
  const mouth = ctx.createRadialGradient(side * RIM, 0, 0, side * RIM, 0, RIM_RADIUS);
  mouth.addColorStop(0, '#ffdcec');
  mouth.addColorStop(0.75, MAGE);
  mouth.addColorStop(1, '#d6336f');
  ctx.beginPath();
  ctx.ellipse(side * RIM, 0, MOUTH, RIM_RADIUS, 0, 0, Math.PI * 2);
  ctx.fillStyle = mouth;
  ctx.fill();
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 4;
  ctx.stroke();
}

export function createDiaboloTexture(): Shape {
  return paint(RADIUS * 3, RADIUS * 3, RADIUS, (ctx) => {
    ctx.scale(UNIT, UNIT);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    for (const side of [-1, 1]) {
      cupPath(ctx, side);
      ctx.lineWidth = 12;
      ctx.stroke();
    }
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(-HUB - 1, 0);
    ctx.lineTo(HUB + 1, 0);
    ctx.stroke();
    cup(ctx, -1);
    cup(ctx, 1);
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-HUB, 0);
    ctx.lineTo(HUB, 0);
    ctx.stroke();
  });
}

import { SHADE, SHADE_SOFT, TAU, WHITE, circle, polygon, rim, type Ctx } from './paint';

type PlayerLook = 'poi' | 'bag' | 'parasol';

// Lying along x, head to the left, its object laid on the ground beside it.
export function lyingBody(ctx: Ctx): void {
  ctx.fillStyle = SHADE_SOFT;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(-4, 0, 16, 10, 0, 0, TAU);
  ctx.fill();
  circle(ctx, 9, -26, 0);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = SHADE_SOFT;
  for (const y of [-4, 4]) {
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(34, y * 1.6);
    ctx.stroke();
  }
}

export function lyingObject(look: PlayerLook, ctx: Ctx): void {
  ctx.save();
  ctx.translate(0, 38);
  ctx.lineCap = 'round';
  if (look === 'poi') {
    ctx.strokeStyle = SHADE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.bezierCurveTo(-26, 12, -6, 18, -18, 4);
    ctx.moveTo(6, 0);
    ctx.bezierCurveTo(26, 12, 6, 18, 18, 4);
    ctx.stroke();
    for (const x of [-18, 18]) {
      circle(ctx, 5.5, x, 4);
      ctx.fillStyle = WHITE;
      ctx.fill();
      rim(ctx, 2);
    }
  } else if (look === 'bag') {
    ctx.rotate(0.12);
    ctx.beginPath();
    ctx.ellipse(-4, 0, 17, 12, 0, 0, TAU);
    ctx.fillStyle = SHADE_SOFT;
    ctx.fill();
    rim(ctx, 2);
    ctx.beginPath();
    ctx.roundRect(14, -10, 9, 20, 4.5);
    ctx.fillStyle = WHITE;
    ctx.fill();
    rim(ctx, 1.6);
  } else {
    ctx.rotate(-0.08);
    polygon(ctx, [
      [-26, 0],
      [0, -7],
      [26, 0],
      [0, 7],
    ]);
    ctx.fillStyle = WHITE;
    ctx.fill();
    rim(ctx, 2);
    ctx.fillStyle = SHADE;
    for (const x of [-10, 10]) {
      polygon(ctx, [
        [x - 6, 0],
        [x, -6 + Math.abs(x) * 0.2],
        [x + 6, 0],
        [x, 6 - Math.abs(x) * 0.2],
      ]);
      ctx.fill();
    }
  }
  ctx.restore();
}

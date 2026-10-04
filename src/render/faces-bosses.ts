import { SHADE_SOFT, TAU, WHITE, circle, polygon, type Ctx } from './paint';
import { INK, type Pose, body, dot, eye, line, mouthArc, shut } from './face-kit';

export function couvreFeu(ctx: Ctx, pose: Pose): void {
  body(ctx, () => {
    polygon(ctx, [
      [-37, -28],
      [-24, -38],
      [24, -38],
      [37, -28],
      [39, 10],
      [24, 34],
      [0, 42],
      [-24, 34],
      [-39, 10],
    ]);
  });
  if (shut(pose)) {
    eye(ctx, pose, -16, 0, 7);
    eye(ctx, pose, 16, 0, 7);
  } else {
    line(ctx, 8, [-34, -17], [-6, -3]);
    line(ctx, 8, [34, -17], [6, -3]);
    ctx.beginPath();
    ctx.ellipse(-16, 3, 8, 4.4, 0, 0, TAU);
    ctx.ellipse(16, 3, 8, 4.4, 0, 0, TAU);
    ctx.fillStyle = INK;
    ctx.fill();
  }
  line(ctx, 4.6, [-22, 25], [-6, 22]);
  ctx.beginPath();
  ctx.roundRect(2, 17, 24, 12, 5);
  circle(ctx, 8.5, 29, 23);
  ctx.fillStyle = SHADE_SOFT;
  ctx.fill();
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  dot(ctx, 29, 23, 3.4);
  ctx.beginPath();
  ctx.roundRect(40, -56, 8, 8, 2);
  ctx.fillStyle = INK;
  ctx.fill();
  circle(ctx, 14, 44, -36);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.lineWidth = 3.4;
  ctx.stroke();
  const angle = Math.floor(pose.t * 4) * (Math.PI / 2);
  line(ctx, 3.2, [44, -36], [44 + Math.sin(angle) * 9, -36 - Math.cos(angle) * 9]);
  dot(ctx, 44, -36, 2.2);
}

export function batterieAPlat(ctx: Ctx, pose: Pose): void {
  body(ctx, () => {
    ctx.beginPath();
    ctx.roundRect(-35, -30, 70, 74, 14);
  });
  ctx.beginPath();
  ctx.roundRect(-11, -42, 22, 10, 3);
  ctx.fillStyle = SHADE_SOFT;
  ctx.fill();
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-24, -22, 48, 14, 5);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
  if (!shut(pose) && pose.t < 0.5) {
    ctx.beginPath();
    ctx.roundRect(-22, -20, 6, 10, 2);
    ctx.fillStyle = INK;
    ctx.fill();
  }
  if (shut(pose)) {
    eye(ctx, pose, -15, 8, 7);
    eye(ctx, pose, 15, 8, 7);
  } else {
    line(ctx, 5, [-25, 5], [-6, 10]);
    line(ctx, 5, [25, 5], [6, 10]);
    dot(ctx, -14, 12, 3.4);
    dot(ctx, 14, 12, 3.4);
  }
  mouthArc(ctx, 0, 38, 12, 1.12, 1.88, 4.4);
}

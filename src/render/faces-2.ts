import { SHADE, SHADE_SOFT, TAU, WHITE, circle, polygon, type Ctx } from './paint';
import {
  INK,
  type Pose,
  body,
  crossEye,
  dot,
  eye,
  hand,
  limb,
  line,
  mouthArc,
  shut,
  sleepingEye,
  step,
  wave,
} from './face-kit';

export function fatigue(ctx: Ctx, pose: Pose): void {
  body(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(0, 5, 38, 33, 0, 0, TAU);
  });
  for (const x of [-14, 14]) {
    if (shut(pose)) {
      eye(ctx, pose, x, -3, 7);
    } else {
      ctx.beginPath();
      ctx.arc(x, -2, 6.4, 0, Math.PI);
      ctx.closePath();
      ctx.fillStyle = INK;
      ctx.fill();
      line(ctx, 4.4, [x - 9, -3], [x + 9, -1]);
    }
    ctx.beginPath();
    ctx.arc(x, 6, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = SHADE;
    ctx.stroke();
  }
  const open = shut(pose) ? 0.25 : step(pose, [0.55, 0.15, 0.7, 1]);
  ctx.beginPath();
  ctx.ellipse(0, 19, 8 + open * 5, 3 + open * 11, 0, 0, TAU);
  ctx.fillStyle = INK;
  ctx.fill();
}

export function filmeur(ctx: Ctx, pose: Pose): void {
  body(ctx, () => {
    ctx.beginPath();
    ctx.roundRect(-34, -31, 68, 66, 24);
  });
  eye(ctx, pose, 12, -6, 9.5, [-2, 0]);
  if (pose.down) {
    crossEye(ctx, -12, -6, 6);
  } else {
    sleepingEye(ctx, -12, -2, 7);
  }
  line(ctx, 3.8, [-10, 22], [6, 22]);
  ctx.save();
  ctx.translate(30, -24);
  ctx.rotate(0.22);
  ctx.beginPath();
  ctx.roundRect(-11, -18, 22, 36, 4);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-8, -14, 16, 26, 2);
  ctx.fillStyle = pose.asleep || pose.down ? SHADE : WHITE;
  ctx.fill();
  if (!shut(pose) && pose.t < 0.5) {
    dot(ctx, 4, -9, 2.4);
  }
  ctx.restore();
  hand(ctx, 33, -4, 6.5);
}

export function bavard(ctx: Ctx, pose: Pose): void {
  body(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(0, 1, 38, 34, 0, 0, TAU);
  });
  eye(ctx, pose, -14, -11, 5);
  eye(ctx, pose, 14, -11, 5);
  if (!shut(pose)) {
    line(ctx, 3.6, [-20, -22], [-9, -24]);
    line(ctx, 3.6, [9, -24], [20, -22]);
  }
  const open = shut(pose) ? 0.3 : step(pose, [1, 0.35, 0.8, 0.15]);
  ctx.beginPath();
  ctx.ellipse(0, 14, 15, 4 + open * 11, 0, 0, TAU);
  ctx.fillStyle = INK;
  ctx.fill();
  if (open > 0.5) {
    ctx.beginPath();
    ctx.ellipse(0, 14 + open * 7, 8, 3.6, 0, 0, TAU);
    ctx.fillStyle = SHADE;
    ctx.fill();
  }
}

export function zombie(ctx: Ctx, pose: Pose): void {
  const sway = pose.down ? 0 : wave(pose) * 0.2;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 27, 6);
    ctx.rotate(side * (0.16 + sway * side));
    limb(ctx, 0, 0, 0, -46, 11);
    hand(ctx, 0, -48, 8);
    ctx.restore();
  }
  body(ctx, () => {
    ctx.beginPath();
    ctx.roundRect(-30, -28, 60, 64, 20);
  });
  for (const x of [-12, 12]) {
    ctx.beginPath();
    ctx.ellipse(x, 6, 9, 4.2, 0, 0, TAU);
    ctx.fillStyle = 'rgb(20 20 20 / 0.55)';
    ctx.fill();
  }
  if (shut(pose)) {
    eye(ctx, pose, -12, 0, 6);
    eye(ctx, pose, 12, 0, 6);
  } else {
    dot(ctx, -12, 0, 5);
    ctx.beginPath();
    ctx.arc(12, 0, 6, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    line(ctx, 3.8, [3, -2], [21, 0]);
  }
  polygon(ctx, [
    [-12, 19],
    [-6, 16],
    [0, 20],
    [6, 16],
    [12, 19],
    [10, 27],
    [-10, 27],
  ]);
  ctx.fillStyle = INK;
  ctx.fill();
  for (const x of [-5, 5]) {
    line(ctx, 2, [x, 20], [x, 25]);
  }
}

export function neutral(ctx: Ctx, pose: Pose): void {
  body(ctx, () => {
    circle(ctx, 37);
  });
  eye(ctx, pose, -12, -4, 4.6);
  eye(ctx, pose, 12, -4, 4.6);
  line(ctx, 3.8, [-10, 18], [10, 18]);
}

export function smile(ctx: Ctx): void {
  body(ctx, () => {
    circle(ctx, 37);
  });
  for (const x of [-13, 13]) {
    mouthArc(ctx, x, -3, 7, 1, 2, 4.2);
  }
  ctx.beginPath();
  ctx.arc(0, 4, 22, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.closePath();
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  for (const x of [-26, 26]) {
    ctx.beginPath();
    ctx.ellipse(x, 6, 5.5, 3.4, 0, 0, TAU);
    ctx.fillStyle = SHADE_SOFT;
    ctx.fill();
  }
}

export function drowsyZ(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-9, -9);
  ctx.lineTo(9, -9);
  ctx.lineTo(-9, 9);
  ctx.lineTo(9, 9);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = WHITE;
  ctx.stroke();
}

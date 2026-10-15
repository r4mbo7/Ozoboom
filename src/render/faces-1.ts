import { TAU, WHITE, circle, polygon, type Ctx } from './paint';
import {
  INK,
  MARK,
  MASK_BODY,
  type Pose,
  body,
  dot,
  eye,
  hand,
  limb,
  line,
  shut,
  sleepingEye,
  stroke,
  wave,
} from './face-kit';

export function random(ctx: Ctx, pose: Pose): void {
  body(ctx, () => {
    circle(ctx, 37);
  });
  const look: readonly [number, number] = [wave(pose) * 2.4, wave(pose, 1, 0.25) * 1.6];
  eye(ctx, pose, -14, -2, 5.5, look);
  eye(ctx, pose, 12, -6, 11, look);
  if (!shut(pose)) {
    ctx.beginPath();
    ctx.arc(-16, -22, 6, Math.PI * 1.05, Math.PI * 2.35);
    ctx.lineTo(-13, -12);
    ctx.lineCap = 'round';
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = MARK;
    ctx.stroke();
    dot(ctx, -13, -6.4, 1.9);
  }
  circle(ctx, 4.5, 2, 20);
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = MARK;
  ctx.stroke();
}

export function desagreable(ctx: Ctx, pose: Pose): void {
  body(ctx, () => {
    polygon(ctx, [
      [-38, -36],
      [-14, -22],
      [0, -26],
      [14, -22],
      [38, -36],
      [32, 2],
      [0, 42],
      [-32, 2],
    ]);
  });
  if (shut(pose)) {
    eye(ctx, pose, -14, 2, 6);
    eye(ctx, pose, 14, 2, 6);
  } else {
    line(ctx, 6, [-30, -14], [-6, -2]);
    line(ctx, 6, [30, -14], [6, -2]);
    dot(ctx, -14, 4, 4.4);
    dot(ctx, 14, 4, 4.4);
  }
  line(ctx, 4, [-16, 24], [-6, 17], [4, 25], [16, 15]);
}

export function meprisant(ctx: Ctx, pose: Pose): void {
  ctx.save();
  ctx.rotate(-0.22);
  body(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(0, -2, 29, 38, 0, 0, TAU);
  });
  for (const x of [-12, 12]) {
    if (shut(pose)) {
      eye(ctx, pose, x, -8, 6);
    } else {
      ctx.beginPath();
      ctx.arc(x, -9, 7, 0, Math.PI);
      ctx.closePath();
      ctx.fillStyle = MARK;
      ctx.fill();
      line(ctx, 4.4, [x - 9, -11], [x + 9, -9]);
    }
  }
  line(ctx, 3.8, [-12, 21], [4, 22], [14, 15]);
  ctx.restore();
}

export function maleAlpha(ctx: Ctx, pose: Pose): void {
  body(ctx, () => {
    polygon(ctx, [
      [-22, -37],
      [22, -37],
      [30, -24],
      [30, 6],
      [39, 14],
      [39, 36],
      [-39, 36],
      [-39, 14],
      [-30, 6],
      [-30, -24],
    ]);
  });
  ctx.save();
  ctx.rotate(pose.down ? -0.1 : 0);
  for (const x of [-15, 15]) {
    ctx.beginPath();
    ctx.roundRect(x - 12, -16, 24, 15, 5);
    ctx.fillStyle = MARK;
    ctx.fill();
    if (!shut(pose)) {
      stroke(ctx, INK, 2.4, [x - 7, -12], [x - 2, -6]);
    }
  }
  line(ctx, 4, [-3, -12], [3, -12]);
  ctx.restore();
  if (shut(pose)) {
    sleepingEye(ctx, -15, -2, 7);
    sleepingEye(ctx, 15, -2, 7);
  }
  line(ctx, 4.4, [-13, 15], [13, 15]);
  line(ctx, 2.6, [-3, 25], [3, 25]);
}

export function collant(ctx: Ctx, pose: Pose): void {
  const reach = pose.down ? 0 : wave(pose) * 5;
  for (const side of [-1, 1]) {
    limb(ctx, side * 24, 6, side * 45, -9 - reach, 10);
    hand(ctx, side * 47, -12 - reach, 8.5);
  }
  body(ctx, () => {
    circle(ctx, 32, 0, 3);
  });
  eye(ctx, pose, -8.5, -6, 10.5, [1.6, 0]);
  eye(ctx, pose, 8.5, -6, 10.5, [-1.6, 0]);
  ctx.beginPath();
  ctx.arc(0, 8, 21, 0.08 * Math.PI, 0.92 * Math.PI);
  ctx.closePath();
  ctx.fillStyle = shut(pose) ? WHITE : INK;
  ctx.fill();
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = MARK;
  ctx.stroke();
  if (!shut(pose)) {
    ctx.beginPath();
    ctx.rect(-14, 8, 28, 4.6);
    ctx.fillStyle = WHITE;
    ctx.fill();
  }
}

export function intolerant(ctx: Ctx, pose: Pose): void {
  const sway = pose.down ? 0 : wave(pose) * 0.2;
  ctx.save();
  ctx.translate(20, -2);
  ctx.rotate(sway);
  limb(ctx, 0, 0, 14, -16, 10);
  limb(ctx, 14, -16, 26, -40, 5.5);
  hand(ctx, 15, -17, 8);
  ctx.restore();
  body(ctx, () => {
    circle(ctx, 34, -4, 2);
  });
  if (shut(pose)) {
    eye(ctx, pose, -17, -2, 6);
    eye(ctx, pose, 9, -2, 6);
  } else {
    dot(ctx, -17, 0, 4.6);
    dot(ctx, 9, 0, 4.6);
    line(ctx, 5, [-27, -10], [-8, -8]);
    line(ctx, 5, [0, -8], [18, -10]);
  }
  line(ctx, 3.6, [-14, 21], [4, 21]);
  for (const x of [-14, -9, -4, 1]) {
    line(ctx, 2.2, [x, 18], [x, 24]);
  }
}

export function arnaqueur(ctx: Ctx, pose: Pose): void {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    polygon(ctx, [
      [side * 34, 4],
      [side * 40, 36],
      [side * 8, 38],
      [side * 20, 14],
    ]);
    ctx.fillStyle = MASK_BODY;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = MARK;
    ctx.stroke();
  }
  body(ctx, () => {
    circle(ctx, 30, 0, 8);
  });
  for (const x of [-11, 11]) {
    if (shut(pose)) {
      eye(ctx, pose, x, 5, 6);
    } else {
      ctx.beginPath();
      ctx.ellipse(x, 6, 7.5, 5, 0, 0, TAU);
      ctx.fillStyle = WHITE;
      ctx.fill();
      dot(ctx, x + 3.4, 6, 3, INK);
      line(ctx, 3.6, [x - 9, 0], [x + 8, 2]);
    }
  }
  line(ctx, 3.4, [-8, 22], [6, 24], [13, 19]);
  ctx.beginPath();
  ctx.ellipse(0, -14, 40, 9, 0, 0, TAU);
  ctx.fillStyle = MASK_BODY;
  ctx.fill();
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = MARK;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-17, -38, 34, 28, 8);
  ctx.fillStyle = MASK_BODY;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-17, -19, 34, 6);
  ctx.fillStyle = MARK;
  ctx.fill();
}

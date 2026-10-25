import {
  type Face,
  INK,
  MARK,
  MASK_BODY,
  type Pose,
  body,
  dot,
  eye,
  gladFace,
  shut,
  stroke,
} from './face-kit';
import { TAU, type Ctx } from './paint';
import { MOCKUP_SCALE } from './vent-moments';

const SOFT = 'rgb(255 255 255 / 0.55)';
const GLAD_SOFT = 'rgb(20 20 20 / 0.35)';
const FACE = { y: 2, rx: 23, ry: 27 };
const LIPS = { y: 15, radius: 3.6, hole: 2.2 };

function brow(ctx: Ctx, soft: string, ink: string): void {
  for (const radius of [16, 11]) {
    ctx.beginPath();
    ctx.arc(0, -10, radius, Math.PI * 1.2, Math.PI * 1.8);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = soft;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(3, -20);
  ctx.lineTo(0, -16);
  ctx.lineTo(-3, -20);
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.fill();
}

function eyeAndCheek(ctx: Ctx, pose: Pose, side: number): void {
  ctx.beginPath();
  ctx.moveTo(side * 3, -6);
  ctx.quadraticCurveTo(side * 11, -13, side * 19, -7);
  ctx.quadraticCurveTo(side * 23, -4, side * 20, -1);
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = MARK;
  ctx.stroke();
  if (shut(pose)) {
    eye(ctx, pose, side * 10, -1, 5);
  } else {
    ctx.save();
    ctx.translate(side * 10, -1);
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.quadraticCurveTo(0, -5, 7, 0);
    ctx.quadraticCurveTo(0, 4, -7, 0);
    ctx.fillStyle = MARK;
    ctx.fill();
    ctx.restore();
    stroke(ctx, MASK_BODY, 2.6, [side * 3, -3.5], [side * 17, -3]);
    dot(ctx, side * 10, 0.5, 1.8, INK);
  }
  const spiral: [number, number][] = [];
  for (let step = 0; step <= 14; step += 1) {
    const angle = step * 0.55;
    const radius = 4.5 * (1 - step / 18);
    spiral.push([side * (14 + Math.cos(angle) * radius * side), 11 + Math.sin(angle) * radius]);
  }
  stroke(ctx, SOFT, 1.4, ...spiral);
}

function coupDeVent(ctx: Ctx, pose: Pose): void {
  ctx.scale(MOCKUP_SCALE, MOCKUP_SCALE);
  body(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(0, FACE.y, FACE.rx, FACE.ry, 0, 0, TAU);
  });
  brow(ctx, SOFT, MARK);
  for (const side of [-1, 1]) {
    eyeAndCheek(ctx, pose, side);
  }
  ctx.beginPath();
  ctx.arc(0, LIPS.y, LIPS.radius, 0, TAU);
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = MARK;
  ctx.stroke();
  dot(ctx, 0, LIPS.y, LIPS.hole, INK);
}

function coupDeVentGlad(ctx: Ctx): void {
  ctx.scale(MOCKUP_SCALE, MOCKUP_SCALE);
  brow(ctx, GLAD_SOFT, INK);
  gladFace(ctx, { eyeY: -2, eyeX: 9, mouthY: 9, mouthWidth: 9, part: 'smile' });
}

export const COUP_DE_VENT_FACE: Face = {
  draw: coupDeVent,
  glad: coupDeVentGlad,
  frames: 1,
  loopBeats: 4,
  boss: true,
};

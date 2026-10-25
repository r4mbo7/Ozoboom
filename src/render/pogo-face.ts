import {
  type Face,
  INK,
  MARK,
  type Pose,
  bodyRimOutside,
  dot,
  eye,
  gladFace,
  line,
  shut,
} from './face-kit';
import { TAU, type Ctx } from './paint';

const HEAD = { y: 2, radius: 30 };
const CREST: readonly (readonly [number, number])[] = [
  [-22, -14],
  [-20, -42],
  [-9, -24],
  [0, -52],
  [9, -24],
  [20, -42],
  [22, -14],
  [0, -8],
];
const EYE = { x: 11, y: -4, radius: 7, pupil: 3, roll: 2 };

function silhouette(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(HEAD.radius, HEAD.y);
  ctx.arc(0, HEAD.y, HEAD.radius, 0, TAU);
  CREST.forEach(([x, y], index) => {
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();
}

function pogo(ctx: Ctx, pose: Pose): void {
  bodyRimOutside(ctx, () => {
    silhouette(ctx);
  });
  line(ctx, 4, [-19, -16], [-6, -13]);
  line(ctx, 4, [19, -16], [6, -13]);
  const roll = pose.t * TAU * 2;
  for (const side of [-1, 1]) {
    if (shut(pose)) {
      eye(ctx, pose, side * EYE.x, EYE.y, 6);
      continue;
    }
    ctx.beginPath();
    ctx.arc(side * EYE.x, EYE.y, EYE.radius, 0, TAU);
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = MARK;
    ctx.stroke();
    dot(ctx, side * EYE.x + Math.sin(roll) * EYE.roll, EYE.y + Math.cos(roll) * 1.5, EYE.pupil);
  }
  ctx.beginPath();
  ctx.moveTo(-17, 8);
  ctx.quadraticCurveTo(0, 34, 17, 8);
  ctx.closePath();
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.lineWidth = 3.2;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = MARK;
  ctx.stroke();
  line(ctx, 2.6, [-13, 12], [13, 12]);
}

function pogoGlad(ctx: Ctx): void {
  gladFace(ctx, { eyeY: -4, mouthY: 10, mouthWidth: 14, part: 'smile' });
}

export const POGO_FACE: Face = {
  draw: pogo,
  glad: pogoGlad,
  frames: 16,
  loopBeats: 4,
  boss: true,
};

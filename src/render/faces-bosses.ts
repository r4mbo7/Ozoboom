import { TAU, circle, type Ctx } from './paint';
import {
  INK,
  MARK,
  MASK_BODY,
  type Pose,
  body,
  bodyRimOutside,
  dot,
  eye,
  gladFace,
  line,
  mouthArc,
  shut,
  stroke,
} from './face-kit';

const SEAM_Y = -33;
const BADGE = { x: 0, y: -47, radius: 10 } as const;
const WHISTLE = { x: 29, y: 23, radius: 8.5 } as const;
export const COUVRE_FEU_WHISTLE: readonly [number, number] = [WHISTLE.x + 1, WHISTLE.y];

const SHIELD: readonly (readonly [number, number])[] = [
  [-37, -28],
  [-24, -38],
  [24, -38],
  [37, -28],
  [39, 10],
  [24, 34],
  [0, 42],
  [-24, 34],
  [-39, 10],
];

function shield(ctx: Ctx): void {
  SHIELD.forEach(([x, y], index) => {
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();
}

function cap(ctx: Ctx): void {
  ctx.moveTo(-38, -30);
  ctx.bezierCurveTo(-40, -62, 40, -62, 38, -30);
  ctx.closePath();
  ctx.moveTo(47, -30);
  ctx.ellipse(0, -30, 47, 9, 0, 0, TAU);
}

function seam(ctx: Ctx): void {
  ctx.globalAlpha = 0.55;
  line(ctx, 4, [-41, SEAM_Y], [41, SEAM_Y]);
  ctx.globalAlpha = 1;
}

export function couvreFeuCap(ctx: Ctx): void {
  bodyRimOutside(ctx, () => {
    ctx.beginPath();
    cap(ctx);
  });
  seam(ctx);
}

export function couvreFeu(ctx: Ctx, pose: Pose): void {
  const beats = pose.t * 4;
  const blow = Math.floor(beats) === 0 ? beats % 1 : 0;
  bodyRimOutside(ctx, () => {
    ctx.beginPath();
    shield(ctx);
    cap(ctx);
  });
  seam(ctx);
  if (shut(pose)) {
    eye(ctx, pose, -16, 0, 7);
    eye(ctx, pose, 16, 0, 7);
  } else {
    line(ctx, 8, [-34, -16], [-6, -4]);
    line(ctx, 8, [34, -16], [6, -4]);
    ctx.beginPath();
    ctx.ellipse(-16, 3, 8, 3.6, 0, 0, TAU);
    ctx.ellipse(16, 3, 8, 3.6, 0, 0, TAU);
    ctx.fillStyle = MARK;
    ctx.fill();
  }
  if (blow > 0) {
    ctx.globalAlpha = 0.55 * (1 - blow);
    ctx.beginPath();
    ctx.ellipse(-4, 22, 7 + 3 * Math.sin(Math.PI * blow), 5, 0, 0, TAU);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = MARK;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  line(ctx, 4.6, [-22, 25], [-6, 22]);
  ctx.beginPath();
  ctx.roundRect(2, WHISTLE.y - 6, 24, 12, 5);
  ctx.moveTo(WHISTLE.x + WHISTLE.radius, WHISTLE.y);
  ctx.arc(WHISTLE.x, WHISTLE.y, WHISTLE.radius, 0, TAU);
  ctx.fillStyle = MASK_BODY;
  ctx.fill();
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = MARK;
  ctx.stroke();
  dot(ctx, WHISTLE.x, WHISTLE.y, 3.4);
  dot(ctx, BADGE.x, BADGE.y, BADGE.radius);
  const angle = Math.floor(beats) * (Math.PI / 2);
  stroke(
    ctx,
    INK,
    2.8,
    [BADGE.x, BADGE.y],
    [BADGE.x + Math.sin(angle) * 7, BADGE.y - Math.cos(angle) * 7],
  );
  dot(ctx, BADGE.x, BADGE.y, 1.8, INK);
}

export function couvreFeuGlad(ctx: Ctx): void {
  gladFace(ctx, { eyeY: -2, mouthY: 12, part: 'smile' });
  stroke(ctx, INK, 4, [-40, SEAM_Y], [40, SEAM_Y]);
  circle(ctx, BADGE.radius - 1, BADGE.x, BADGE.y + 1);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function battery(ctx: Ctx, bulge: number): void {
  ctx.beginPath();
  ctx.moveTo(-21, -30);
  ctx.lineTo(21, -30);
  ctx.quadraticCurveTo(35, -30, 35, -16);
  ctx.quadraticCurveTo(35 + bulge, 7, 35, 30);
  ctx.quadraticCurveTo(35, 44, 21, 44);
  ctx.lineTo(-21, 44);
  ctx.quadraticCurveTo(-35, 44, -35, 30);
  ctx.quadraticCurveTo(-35 - bulge, 7, -35, -16);
  ctx.quadraticCurveTo(-35, -30, -21, -30);
  ctx.closePath();
}

const TERMINAL = [-11, -42, 22, 10, 3] as const;
const SLOT = [-25, -23, 50, 16, 5] as const;
const SLOT_DARK = '#0e0f16';

function fittings(ctx: Ctx, fill: string, slot: string, rim: string): void {
  ctx.beginPath();
  ctx.roundRect(...TERMINAL);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = rim;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(...SLOT);
  ctx.fillStyle = slot;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function batterieAPlat(ctx: Ctx, pose: Pose): void {
  body(ctx, () => {
    battery(ctx, 0);
  });
  fittings(ctx, MASK_BODY, SLOT_DARK, MARK);
  if (shut(pose)) {
    eye(ctx, pose, -15, 8, 7);
    eye(ctx, pose, 15, 8, 7);
  } else {
    line(ctx, 5, [-25, 5], [-6, 10]);
    line(ctx, 5, [25, 5], [6, 10]);
    dot(ctx, -14, 13, 3.4);
    dot(ctx, 14, 13, 3.4);
  }
  mouthArc(ctx, 0, 38, 12, 1.12, 1.88, 4.4);
  ctx.save();
  ctx.globalAlpha = 1 - pose.t;
  ctx.translate(27, -8 + pose.t * 18);
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.quadraticCurveTo(4, 1, 0, 3);
  ctx.quadraticCurveTo(-4, 1, 0, -5);
  ctx.fillStyle = MARK;
  ctx.fill();
  ctx.restore();
}

export function batterieAPlatFlanks(ctx: Ctx): void {
  body(ctx, () => {
    battery(ctx, 9);
  });
  ctx.globalCompositeOperation = 'destination-out';
  ctx.save();
  ctx.scale(0.9, 0.9);
  battery(ctx, 0);
  ctx.restore();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

export function batterieAPlatGlad(ctx: Ctx): void {
  gladFace(ctx, { eyeY: 8, mouthY: 22, mouthWidth: 13, part: 'smile' });
  ctx.beginPath();
  ctx.roundRect(...TERMINAL);
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(...SLOT);
  ctx.lineWidth = 3;
  ctx.stroke();
}

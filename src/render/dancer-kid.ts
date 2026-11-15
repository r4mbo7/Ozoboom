import { clamp01, frac, lerp, smoothstep } from '../shared/scalar';
import {
  BAR_BEATS,
  EDGE,
  type Dance,
  type Jump,
  ellipse,
  faded,
  fill,
  inked,
  segment,
} from './dance-kit';
import { TAU, circle, type Ctx } from './paint';

// As drawn on the choice page: a kid in a fluffy eared hood who jumps for joy, both fists up.
const SKIN = '#f1c7a0';
const HAIR = '#5a3a22';
const FUR = '#9a72d8';
const FUR_LIGHT = '#c4a6f2';
const FUR_DARK = '#5e4499';
const EAR_IN = '#e7a8d6';
const PANTS = '#7d5236';
const SHOE = '#3d86d6';
const SOLE = '#f4f1ea';
const MOUTH = '#4a1824';
const TEETH = '#fffaf0';
const CHEEK = '#ff8a8a';

const HOP = 0.07;
const LANDING_BEATS = 0.7;
const SQUASH = 0.05;

interface Pose extends Jump {
  readonly arms: number;
  readonly legs: number;
}

// His bar: two little bounces, then a jump from beat 2 that lands on beat 4.
function poseAt(beatInBar: number): Pose {
  const beat = frac((beatInBar + 1) / BAR_BEATS) * BAR_BEATS;
  const bouncing = beat < 2;
  const air = bouncing ? 0 : Math.sin((Math.PI * (beat - 2)) / 2);
  const bounce = Math.sin(Math.PI * frac(beat));
  const spread = smoothstep(clamp01(air * 1.6));
  return {
    height: air + (bouncing ? HOP * bounce : 0),
    arms: Math.max(bouncing ? 0.3 + 0.2 * bounce : 0.3, spread),
    legs: spread,
    landing: beat < LANDING_BEATS ? beat / LANDING_BEATS : null,
    squash: bouncing ? SQUASH * Math.exp(-6 * frac(beat)) : 0,
  };
}

// An ellipse ringed with tufts, rimmed once around the whole silhouette.
function fluff(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  tufts: number,
  bump: number,
) {
  const around = Array.from({ length: tufts }, (_, index) => {
    const angle = (index * TAU) / tufts;
    return [x + Math.cos(angle) * rx, y + Math.sin(angle) * ry] as const;
  });
  for (const [radius, width, color] of [
    [bump + 1.1, 1.1, EDGE],
    [bump, 0, FUR],
  ] as const) {
    for (const [tx, ty] of around) {
      circle(ctx, radius, tx, ty);
      fill(ctx, color);
    }
    ellipse(ctx, x, y, rx + width, ry + width);
    fill(ctx, color);
  }
}

function legs(ctx: Ctx, spread: number): void {
  const angle = lerp(0.32, 1.2, spread);
  for (const side of [-1, 1]) {
    const hip = [3 * side, 10] as const;
    const foot = [hip[0] + Math.sin(angle) * 10 * side, hip[1] + Math.cos(angle) * 10] as const;
    segment(ctx, hip, foot);
    inked(ctx, PANTS, 5.6, 2.6);
    const turn = Math.atan2(foot[1] - hip[1], foot[0] - hip[0]);
    ellipse(ctx, foot[0], foot[1], 3.3, 2.3, turn);
    fill(ctx, SHOE, 1.2);
    faded(ctx, 0.9, () => {
      ellipse(ctx, foot[0] + Math.cos(turn) * 1.6, foot[1] + Math.sin(turn) * 1.6, 1.3, 1.6, turn);
      fill(ctx, SOLE);
    });
  }
}

function torso(ctx: Ctx): void {
  ellipse(ctx, 0, 11, 6.6, 3.4);
  fill(ctx, PANTS, 1.3);
  ellipse(ctx, 0, 4, 6.4, 8);
  fill(ctx, SKIN, 1.4);
  for (const side of [-1, 1]) {
    fluff(ctx, 5 * side, 3.2, 2.4, 7.2, 10, 1.7);
    faded(ctx, 0.4, () => {
      ellipse(ctx, 5 * side - 0.6, 0.5, 1, 3.6);
      fill(ctx, FUR_LIGHT);
    });
  }
}

function hood(ctx: Ctx): void {
  for (const side of [-1, 1]) {
    circle(ctx, 3.8, 7.9 * side, -16.8);
    fill(ctx, FUR, 1.4);
    circle(ctx, 1.9, 7.9 * side, -16.8);
    fill(ctx, EAR_IN);
  }
  fluff(ctx, 0, -8, 8.4, 8.2, 13, 2);
  faded(ctx, 0.4, () => {
    ctx.beginPath();
    ctx.arc(0, -8, 9.4, 1.1 * Math.PI, 1.55 * Math.PI);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = FUR_LIGHT;
    ctx.stroke();
  });
  circle(ctx, 7, 0, -7.4);
  fill(ctx, FUR_DARK);
  circle(ctx, 6, 0, -7.2);
  fill(ctx, SKIN, 1.2);
  ellipse(ctx, 0, -11.6, 4.4, 1.9);
  fill(ctx, HAIR);
}

// Happy squinting eyes and a big grin with a gap in the teeth.
function grin(ctx: Ctx): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1.1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(2.3 * side, -7.6, 1.3, 1.1 * Math.PI, 1.9 * Math.PI);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-3.3, -5.4);
  ctx.quadraticCurveTo(0, -5.9, 3.3, -5.4);
  ctx.quadraticCurveTo(2.6, -1.6, 0, -1.5);
  ctx.quadraticCurveTo(-2.6, -1.6, -3.3, -5.4);
  ctx.closePath();
  fill(ctx, MOUTH, 0.9);
  for (const x of [-2.6, 0.7]) {
    ctx.beginPath();
    ctx.roundRect(x, -5.5, 1.9, 1.3, 0.4);
    fill(ctx, TEETH);
  }
  faded(ctx, 0.35, () => {
    for (const side of [-1, 1]) {
      circle(ctx, 1.2, 4.2 * side, -5.6);
      fill(ctx, CHEEK);
    }
  });
}

function drawKid(ctx: Ctx, beatInBar: number): void {
  const jump = poseAt(beatInBar);
  legs(ctx, jump.legs);
  torso(ctx);
  const fist = [lerp(12, 15, jump.arms), lerp(-14, -25, jump.arms)] as const;
  for (const side of [-1, 1]) {
    segment(ctx, [7.5 * side, -0.5], [fist[0] * side, fist[1]]);
    inked(ctx, SKIN, 3.9, 2.5);
  }
  hood(ctx);
  grin(ctx);
  for (const side of [-1, 1]) {
    circle(ctx, 3.4, fist[0] * side, fist[1]);
    fill(ctx, SKIN, 1.3);
  }
}

export const KID: Dance = { frames: 16, still: 0, draw: drawKid, jumpAt: poseAt };

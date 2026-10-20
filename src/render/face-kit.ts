import { type PaletteToken, SUN_PALETTES } from '../shared/palette';
import { SHADE_SOFT, TAU, WHITE, circle, type Ctx } from './paint';

export const FACE_RADIUS = 40;
// A boss mask is painted, and drawn, at twice a bad vibe's size.
export const BOSS_SCALE = 2;
export const NEUTRAL = 'neutral';

export const INK = '#141414';
// Masks stand against the light: a dark body, a pale rim and pale marks. The rim token of the hour
// tints them, so the rim and the marks take its color and the body a dark share of it.
export const MARK = WHITE;
export const MASK_BODY = '#262626';
const MASK_BODY_LIT = '#3a3a3a';
const RIM = 7;

export function maskTone(tint: number, gray: string): number {
  const share = Number.parseInt(gray.slice(1, 3), 16) / 255;
  const channel = (shift: number) => Math.round(((tint >> shift) & 0xff) * share);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export interface Pose {
  // Position in the animation loop, from 0 included to 1 excluded.
  readonly t: number;
  readonly asleep: boolean;
  readonly down: boolean;
}

export interface Face {
  readonly draw: (ctx: Ctx, pose: Pose) => void;
  // Awake frames in one loop; 1 for a mask that does not move.
  readonly frames: number;
  readonly loopBeats: number;
  readonly boss: boolean;
  // A mask whose tone leans toward a palette token, so that it stays gray but not the same gray.
  readonly tone?: { readonly token: PaletteToken; readonly amount: number };
  // Sleepers and the Fatigué let small "z" rise above them.
  readonly drowsy?: boolean;
  // A boss chased: its silhouette is filled bright, white at heart, in the color of whoever chased
  // it, and wears this smile in ink; `gladFace` without it.
  readonly glad?: (ctx: Ctx) => void;
}

export function wave(pose: Pose, turns = 1, shift = 0): number {
  return Math.sin((pose.t * turns + shift) * TAU);
}

export function step(pose: Pose, values: readonly number[]): number {
  return values[Math.min(values.length - 1, Math.floor(pose.t * values.length))] ?? 0;
}

export function shut(pose: Pose): boolean {
  return pose.asleep || pose.down;
}

export function body(ctx: Ctx, trace: () => void): void {
  ctx.save();
  trace();
  ctx.clip();
  const light = ctx.createRadialGradient(-10, -14, 4, 0, 0, 56);
  light.addColorStop(0, MASK_BODY_LIT);
  light.addColorStop(1, MASK_BODY);
  ctx.fillStyle = light;
  ctx.fillRect(-80, -80, 160, 160);
  ctx.restore();
  trace();
  ctx.lineJoin = 'round';
  ctx.lineWidth = RIM;
  ctx.strokeStyle = MARK;
  ctx.stroke();
}

// The rim all outside the outline, as wide as the masks' own: shapes traced together, overlapping,
// share one rim round them all.
export function bodyRimOutside(ctx: Ctx, trace: () => void): void {
  trace();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2 * RIM;
  ctx.strokeStyle = MARK;
  ctx.stroke();
  ctx.save();
  trace();
  ctx.clip();
  const light = ctx.createRadialGradient(-10, -14, 4, 0, 0, 56);
  light.addColorStop(0, MASK_BODY_LIT);
  light.addColorStop(1, MASK_BODY);
  ctx.fillStyle = light;
  ctx.fillRect(-80, -80, 160, 160);
  ctx.restore();
}

// The smile of a chased bad vibe is painted bright, to take the color of whoever chased it.
export function gladBody(ctx: Ctx, trace: () => void): void {
  ctx.save();
  trace();
  ctx.clip();
  const light = ctx.createRadialGradient(-10, -14, 4, 0, 0, 56);
  light.addColorStop(0, WHITE);
  light.addColorStop(0.55, WHITE);
  light.addColorStop(1, SHADE_SOFT);
  ctx.fillStyle = light;
  ctx.fillRect(-80, -80, 160, 160);
  ctx.restore();
  trace();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

export function limb(
  ctx: Ctx,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  width = 9,
): void {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.lineWidth = width + 3.6;
  ctx.strokeStyle = MARK;
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = MASK_BODY;
  ctx.stroke();
}

export function hand(ctx: Ctx, x: number, y: number, radius = 6.5): void {
  circle(ctx, radius, x, y);
  ctx.fillStyle = MASK_BODY;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = MARK;
  ctx.stroke();
}

export function dot(ctx: Ctx, x: number, y: number, radius: number, color = MARK): void {
  circle(ctx, radius, x, y);
  ctx.fillStyle = color;
  ctx.fill();
}

export function line(
  ctx: Ctx,
  width: number,
  ...points: readonly (readonly [number, number])[]
): void {
  stroke(ctx, MARK, width, ...points);
}

export function stroke(
  ctx: Ctx,
  color: string,
  width: number,
  ...points: readonly (readonly [number, number])[]
): void {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

export function sleepingEye(ctx: Ctx, x: number, y: number, width: number): void {
  ctx.beginPath();
  ctx.arc(x, y - width * 0.4, width, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.6;
  ctx.strokeStyle = MARK;
  ctx.stroke();
}

export function crossEye(ctx: Ctx, x: number, y: number, size: number): void {
  line(ctx, 3.4, [x - size, y - size], [x + size, y + size]);
  line(ctx, 3.4, [x + size, y - size], [x - size, y + size]);
}

// An open eye: a pale disc and a dark pupil. A shut mask shows it asleep or crossed.
export function eye(
  ctx: Ctx,
  pose: Pose,
  x: number,
  y: number,
  radius: number,
  look: readonly [number, number] = [0, 0],
): void {
  if (pose.down) {
    crossEye(ctx, x, y, radius * 0.7);
    return;
  }
  if (pose.asleep) {
    sleepingEye(ctx, x, y, radius);
    return;
  }
  circle(ctx, radius, x, y);
  ctx.fillStyle = WHITE;
  ctx.fill();
  dot(ctx, x + look[0], y + look[1], radius * 0.46, INK);
}

export function mouthArc(
  ctx: Ctx,
  x: number,
  y: number,
  radius: number,
  from: number,
  to: number,
  width = 3.6,
  color = MARK,
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, from * Math.PI, to * Math.PI);
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

export interface GladPlace {
  readonly eyeY?: number;
  readonly eyeX?: number;
  readonly mouthY?: number;
  readonly mouthWidth?: number;
  // The blushes go on the tinted body, the smile over the white light at its heart.
  readonly part?: 'blush' | 'smile';
}

// The smile of a chased boss, in ink on its bright body: eyes shut with joy, an open mouth, blushes.
export function gladFace(ctx: Ctx, place: GladPlace = {}): void {
  const { eyeY = -4, eyeX = 13, mouthY = 12, mouthWidth = 15, part } = place;
  if (part !== 'smile') {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * (eyeX + 9), eyeY + 12, 5.5, 3.6, 0, 0, TAU);
      ctx.fillStyle = SHADE_SOFT;
      ctx.fill();
    }
  }
  if (part === 'blush') {
    return;
  }
  for (const side of [-1, 1]) {
    mouthArc(ctx, side * eyeX, eyeY + 3, 6, 1.1, 1.9, 4.4, INK);
  }
  ctx.beginPath();
  ctx.moveTo(-mouthWidth, mouthY);
  ctx.quadraticCurveTo(0, mouthY + mouthWidth * 1.3, mouthWidth, mouthY);
  ctx.closePath();
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-mouthWidth * 0.5, mouthY + mouthWidth * 0.55);
  ctx.quadraticCurveTo(0, mouthY + mouthWidth * 0.85, mouthWidth * 0.5, mouthY + mouthWidth * 0.55);
  ctx.fillStyle = SHADE_SOFT;
  ctx.fill();
}

type Crack = readonly [PaletteToken, ...(readonly [number, number])[]];

const CRACKS: readonly Crack[] = [
  ['mage', [-24, -14], [-16, -11], [-14, -4], [-7, -3], [-5, 3]],
  ['turquoise', [17, 22], [12, 15], [15, 10], [8, 6]],
  ['or', [7, -27], [4, -19], [9, -14], [3, -8]],
];

// The cracks of a hurt mask, one more per stage, kept inside every body. Painted in the colors of
// the night whatever the hour: they glow on the dark body, like the burst they announce.
export function cracks(ctx: Ctx, stage: number): void {
  for (const [token, ...points] of CRACKS.slice(0, stage)) {
    const color = SUN_PALETTES.nuit[token];
    ctx.globalAlpha = 0.45;
    stroke(ctx, color, 6, ...points);
    ctx.globalAlpha = 1;
    stroke(ctx, color, 2.2, ...points);
    ctx.globalAlpha = 0.7;
    stroke(ctx, WHITE, 0.8, ...points);
  }
  ctx.globalAlpha = 1;
}

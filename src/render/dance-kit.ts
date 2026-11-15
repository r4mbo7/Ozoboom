import { frac } from '../shared/scalar';
import { TAU, type Ctx } from './paint';

// What the dancers under the masks share: drawn seen from the sky with the face upright, in units
// where their game radius is 13, and painted a frame at a time over a bar.
export const DANCER = { size: 13, canvas: 72, density: 2 };
export const BAR_BEATS = 4;
export const EDGE = 'rgba(4, 6, 18, 0.9)';

// Off the ground, as his shadow tells.
export interface Jump {
  // 0 on the ground, 1 at the top of a jump.
  readonly height: number;
  // From 0 to 1 just after he lands, otherwise null.
  readonly landing: number | null;
  readonly squash: number;
}

export const GROUNDED: Jump = { height: 0, landing: null, squash: 0 };

export interface Dance {
  readonly frames: number;
  // The beat of his still pose in calm mode.
  readonly still: number;
  // His pose `beatInBar` beats into the bar.
  readonly draw: (ctx: Ctx, beatInBar: number) => void;
  readonly jumpAt: (beatInBar: number) => Jump;
}

// Which of a dance's painted frames he is in, `beatInBar` beats into the bar.
export function frameAt(dance: Dance, beatInBar: number): number {
  return Math.floor(frac(beatInBar / BAR_BEATS) * dance.frames) % dance.frames;
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, turn = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, turn, 0, TAU);
}

export function fill(ctx: Ctx, color: string, edge = 0): void {
  ctx.fillStyle = color;
  ctx.fill();
  if (edge > 0) {
    ctx.lineWidth = edge;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
  }
}

export function segment(ctx: Ctx, from: readonly [number, number], to: readonly [number, number]) {
  ctx.beginPath();
  ctx.moveTo(...from);
  ctx.lineTo(...to);
  ctx.lineCap = 'round';
}

export function inked(ctx: Ctx, color: string, width: number, edge: number): void {
  ctx.lineWidth = width + edge;
  ctx.strokeStyle = EDGE;
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

export function faded(ctx: Ctx, alpha: number, draw: () => void): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  draw();
  ctx.restore();
}

import { NIGHT_END, NIGHT_START, paletteAt } from '../shared/palette';
import { FACES, type Face } from './faces';
import type { Ctx } from './paint';
import { mixColor, parseHexColor } from './palette';
import { fitPortraitCanvas } from './portrait-canvas';

// The square a mask is drawn in, in its own units: the cell of its texture; a boss, drawn larger
// than its cell's share, keeps a margin.
const CELL = 144;
const BOSS_CELL = 168;
const MAX_PIXELS = 512;
const NIGHT = paletteAt((NIGHT_START + NIGHT_END) / 2);
const AWAKE = { t: 0, asleep: false, down: false };

// The tint the game puts on the mask at night.
export function maskTint({ lit, tone }: Face): string | null {
  if (lit === true) {
    return null;
  }
  const rim = parseHexColor(NIGHT.badVibeRim);
  const tint =
    tone === undefined ? rim : mixColor(rim, parseHexColor(NIGHT[tone.token]), tone.amount);
  return `#${tint.toString(16).padStart(6, '0')}`;
}

function faceOf(enemyId: string): Face {
  const face = FACES[enemyId];
  if (face === undefined) {
    throw new Error(`No mask for "${enemyId}"`);
  }
  return face;
}

// Still, untinted, centred in a square of `size` pixels.
export function drawMask(ctx: Ctx, enemyId: string, size: number): void {
  const face = faceOf(enemyId);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  const scale = size / (face.boss ? BOSS_CELL : CELL);
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);
  face.draw(ctx, AWAKE);
  ctx.restore();
}

// The tint multiplies the drawing as a sprite's does; the drawing laid again keeps only its shape.
export function tintMask(ctx: Ctx, drawing: CanvasImageSource, size: number, tint: string): void {
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(drawing, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(drawing, 0, 0);
  ctx.restore();
}

// A bad vibe's or a boss's mask filling its canvas, still and tinted as the game shows it at night.
export function paintMask(canvas: HTMLCanvasElement, enemyId: string): void {
  const fitted = fitPortraitCanvas(canvas, MAX_PIXELS);
  if (fitted === null) {
    return;
  }
  const size = Math.min(fitted.width, fitted.height);
  const tint = maskTint(faceOf(enemyId));
  if (tint === null) {
    drawMask(fitted.target, enemyId, size);
    return;
  }
  const drawing = document.createElement('canvas');
  drawing.width = size;
  drawing.height = size;
  const ctx = drawing.getContext('2d');
  if (ctx === null) {
    throw new Error('Canvas 2D context is unavailable');
  }
  drawMask(ctx, enemyId, size);
  tintMask(fitted.target, drawing, size, tint);
}

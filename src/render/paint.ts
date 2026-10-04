import { CanvasSource, Texture } from 'pixi.js';

export interface Shape {
  readonly texture: Texture;
  readonly radius: number;
}

export const TAU = Math.PI * 2;
export const WHITE = '#ffffff';
// Textures are white and grays: the palette of the hour reaches them by tint, so a gray is a darker shade of it.
export const SHADE = '#808080';
export const SHADE_SOFT = '#b4b4b4';
export const SHADE_DEEP = '#404040';

export type Ctx = CanvasRenderingContext2D;
type Draw = (ctx: Ctx) => void;

export function paint(width: number, height: number, radius: number, draw: Draw): Shape {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('Canvas 2D context is unavailable');
  }
  ctx.translate(width / 2, height / 2);
  draw(ctx);
  const source = new CanvasSource({ resource: canvas, autoGenerateMipmaps: true });
  return { texture: new Texture({ source }), radius };
}

export function polygon(
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
) {
  ctx.beginPath();
  for (const [x, y] of points) {
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function circle(ctx: CanvasRenderingContext2D, radius: number, x = 0, y = 0) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
}

export function star(ctx: CanvasRenderingContext2D, points: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (index / (points * 2)) * TAU - Math.PI / 2;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
}

export function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

// Two thin parallel lines along the current path: a wide stroke, then its middle knocked out.
export function doubleStroke(ctx: Ctx, outer: number, gap: number) {
  ctx.lineWidth = outer;
  ctx.stroke();
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = gap;
  ctx.stroke();
  ctx.restore();
}

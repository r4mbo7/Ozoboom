import { CanvasSource, Rectangle, Texture, type TextureSource } from 'pixi.js';

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
export type Draw = (ctx: Ctx) => void;

// Width and height of the cell, the radius the shape stands for, and how to draw it around (0, 0).
export type Piece = readonly [width: number, height: number, radius: number, draw: Draw];

function canvas2d(width: number, height: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('Canvas 2D context is unavailable');
  }
  return { canvas, ctx };
}

export function paint(width: number, height: number, radius: number, draw: Draw): Shape {
  const { canvas, ctx } = canvas2d(width, height);
  ctx.translate(width / 2, height / 2);
  draw(ctx);
  const source = new CanvasSource({ resource: canvas, autoGenerateMipmaps: true });
  return { texture: new Texture({ source }), radius };
}

const SHEET_WIDTH = 1024;
// Room between the cells, so that the smaller mipmap levels do not bleed one into the other.
const SHEET_GAP = 4;

export interface Sheet<K extends string> {
  readonly shapes: Readonly<Record<K, Shape>>;
  readonly source: TextureSource;
}

// Many shapes painted on one canvas: drawn together, they share a texture, so that the batch of
// sprites holds whatever number of them, and the GPU binds one texture instead of many.
export function paintSheet<K extends string>(pieces: Readonly<Record<K, Piece>>): Sheet<K> {
  const names = (Object.keys(pieces) as K[]).sort((a, b) => pieces[b][1] - pieces[a][1]);
  const places = new Map<K, readonly [number, number]>();
  let x = SHEET_GAP;
  let y = SHEET_GAP;
  let row = 0;
  for (const name of names) {
    const [width, height] = pieces[name];
    if (x + width + SHEET_GAP > SHEET_WIDTH) {
      x = SHEET_GAP;
      y += row + SHEET_GAP;
      row = 0;
    }
    places.set(name, [x, y]);
    x += width + SHEET_GAP;
    row = Math.max(row, height);
  }
  const { canvas, ctx } = canvas2d(SHEET_WIDTH, y + row + SHEET_GAP);
  for (const name of names) {
    const [width, height, , draw] = pieces[name];
    const [left, top] = places.get(name) ?? [0, 0];
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, width, height);
    ctx.clip();
    ctx.translate(left + width / 2, top + height / 2);
    draw(ctx);
    ctx.restore();
  }
  const source = new CanvasSource({ resource: canvas, autoGenerateMipmaps: true });
  const shapes = {} as Record<K, Shape>;
  for (const name of names) {
    const [width, height, radius] = pieces[name];
    const [left, top] = places.get(name) ?? [0, 0];
    shapes[name] = {
      texture: new Texture({ source, frame: new Rectangle(left, top, width, height) }),
      radius,
    };
  }
  return { shapes, source };
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

export function rim(ctx: Ctx, width = 2): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = SHADE_DEEP;
  ctx.stroke();
}

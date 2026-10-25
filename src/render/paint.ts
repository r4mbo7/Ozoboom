import { CanvasSource, Rectangle, Texture, type TextureSource } from 'pixi.js';
import { keysOf, recordOf } from '../shared/records';

export interface Shape {
  readonly texture: Texture;
  readonly radius: number;
}

export const TAU = Math.PI * 2;
export const WHITE = '#ffffff';
// Textures are white and grays: the palette of the hour reaches them by tint.
export const SHADE = '#808080';
export const SHADE_SOFT = '#b4b4b4';
export const SHADE_DEEP = '#404040';

export type Ctx = CanvasRenderingContext2D;
export type Draw = (ctx: Ctx) => void;

export type Piece = readonly [width: number, height: number, radius: number, draw: Draw];

export interface Later<T> {
  get(): T;
  readonly painted: T | undefined;
}

export function paintedLater<T>(make: () => T): Later<T> {
  let made: T | undefined;
  return {
    get: () => (made ??= make()),
    get painted() {
      return made;
    },
  };
}

function canvas2d(
  width: number,
  height: number,
  density: number,
): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * density);
  canvas.height = Math.ceil(height * density);
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('Canvas 2D context is unavailable');
  }
  ctx.scale(density, density);
  return { canvas, ctx };
}

function sourceOf(canvas: HTMLCanvasElement, density: number): CanvasSource {
  return new CanvasSource({ resource: canvas, resolution: density, autoGenerateMipmaps: true });
}

export function paint(
  width: number,
  height: number,
  radius: number,
  draw: Draw,
  density = 1,
): Shape {
  const { canvas, ctx } = canvas2d(width, height, density);
  ctx.translate(width / 2, height / 2);
  draw(ctx);
  return { texture: new Texture({ source: sourceOf(canvas, density) }), radius };
}

const SHEET_WIDTH = 1024;
// So that the smaller mipmap levels do not bleed one into the other.
const SHEET_GAP = 4;

export interface Sheet<K extends string> {
  readonly shapes: Readonly<Record<K, Shape>>;
  readonly source: TextureSource;
}

// One canvas for many shapes: the GPU binds one texture, and one batch holds any number of sprites.
export function paintSheet<K extends string>(
  pieces: Readonly<Record<K, Piece>>,
  density = 1,
): Sheet<K> {
  const names = keysOf(pieces).sort((a, b) => pieces[b][1] - pieces[a][1]);
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
  const { canvas, ctx } = canvas2d(SHEET_WIDTH, y + row + SHEET_GAP, density);
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
  const source = sourceOf(canvas, density);
  const shapes = recordOf(names, (name): Shape => {
    const [width, height, radius] = pieces[name];
    const [left, top] = places.get(name) ?? [0, 0];
    return {
      texture: new Texture({ source, frame: new Rectangle(left, top, width, height) }),
      radius,
    };
  });
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

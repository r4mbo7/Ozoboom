import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { BOSS_CELL } from './textures-enemies';
import { BOSS_SCALE, FACE_RADIUS, INK, gladFace, type Face } from './face-kit';
import { TAU, WHITE, type Ctx, type Shape } from './paint';

// Rim band, in mask units: what the rim gains when it breathes or whitens.
const BAND = 4;
// The mask's own rim, in mask units: cracks and the glad body stay inside it.
const RIM_INSIDE = 3.5;
const GLAD_LINE = 1.8;
const DIRECTIONS = 16;

type Point = readonly [number, number];

// Run across the mask from its edge, in mask units: the first at two thirds of its life, all three
// at one third.
const CRACKS: readonly (readonly Point[])[] = [
  [
    [6, -42],
    [2, -24],
    [8, -14],
    [1, -2],
    [5, 6],
  ],
  [
    [-46, 8],
    [-26, 12],
    [-20, 4],
    [-8, 14],
  ],
  [
    [44, 22],
    [26, 18],
    [22, 30],
    [12, 28],
  ],
];

export interface BossLook {
  // White outside the mask's rim, as wide as BAND: the rim that breathes and whitens.
  readonly band: Shape;
  // Dark cracks with a pale lip, kept inside the rim: two thirds, then one third of life lost.
  readonly cracks: readonly [Shape, Shape];
  // Every crack as white light, for the gold that shines through them when it is chased.
  readonly light: Shape;
  // The chased mask, tinted in the color of whoever chased it: its silhouette with blushes. Then,
  // untinted, the white light at its heart and, tinted, its smile: `Face.glad` or `gladFace`.
  readonly glad: Shape;
  readonly heart: Shape;
  readonly smile: Shape;
  destroy(): void;
}

function canvasOf(size: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('Canvas 2D context is unavailable');
  }
  return { canvas, ctx };
}

// Draws in mask units around the middle of a boss cell.
function inMask(ctx: Ctx, draw: (ctx: Ctx) => void): void {
  ctx.save();
  ctx.translate(BOSS_CELL / 2, BOSS_CELL / 2);
  ctx.scale(BOSS_SCALE, BOSS_SCALE);
  draw(ctx);
  ctx.restore();
}

// The mask's shape grown (positive) or shrunk (negative) by `units`: the union, or the
// intersection, of the shape moved all around.
function morph(silhouette: HTMLCanvasElement, units: number): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(BOSS_CELL);
  const reach = Math.abs(units) * BOSS_SCALE;
  ctx.drawImage(silhouette, 0, 0);
  ctx.globalCompositeOperation = units > 0 ? 'source-over' : 'destination-in';
  for (let index = 0; index < DIRECTIONS; index += 1) {
    const angle = (index / DIRECTIONS) * TAU;
    ctx.drawImage(silhouette, Math.cos(angle) * reach, Math.sin(angle) * reach);
  }
  return canvas;
}

function cracksOf(ctx: Ctx, count: number, color: string, width: number, lip: boolean): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const points of CRACKS.slice(0, count)) {
    const trace = (dx: number, dy: number) => {
      ctx.beginPath();
      for (const [x, y] of points) {
        ctx.lineTo(x + dx, y + dy);
      }
    };
    trace(0, 0);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
    if (lip) {
      trace(1.6, 1.2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgb(255 255 255 / 0.45)';
      ctx.stroke();
    }
  }
}

function filled(shape: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const { canvas, ctx } = canvasOf(BOSS_CELL);
  ctx.drawImage(shape, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, BOSS_CELL, BOSS_CELL);
  return canvas;
}

// The boss's own pieces, drawn from its mask: one canvas per boss, made when it first shows up.
export function createBossLook(face: Face): BossLook {
  const { canvas: silhouette, ctx: drawn } = canvasOf(BOSS_CELL);
  inMask(drawn, (ctx) => {
    face.draw(ctx, { t: 0, asleep: false, down: false });
  });
  const inside = morph(silhouette, -RIM_INSIDE);

  const cells: ((ctx: Ctx) => void)[] = [
    (ctx) => {
      ctx.drawImage(morph(silhouette, BAND), 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = WHITE;
      ctx.fillRect(0, 0, BOSS_CELL, BOSS_CELL);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(silhouette, 0, 0);
    },
    ...[1, CRACKS.length].map((count) => (ctx: Ctx) => {
      inMask(ctx, (inner) => {
        cracksOf(inner, count, INK, 3.4, true);
      });
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(inside, 0, 0);
    }),
    (ctx) => {
      inMask(ctx, (inner) => {
        inner.shadowColor = WHITE;
        inner.shadowBlur = 16 * BOSS_SCALE;
        cracksOf(inner, CRACKS.length, WHITE, 6, false);
        inner.shadowBlur = 0;
        cracksOf(inner, CRACKS.length, WHITE, 2.4, false);
      });
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(inside, 0, 0);
    },
    (ctx) => {
      ctx.drawImage(silhouette, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, BOSS_CELL, BOSS_CELL);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(filled(morph(silhouette, -GLAD_LINE), WHITE), 0, 0);
      inMask(ctx, (inner) => {
        gladFace(inner, { part: 'blush' });
      });
    },
    (ctx) => {
      ctx.drawImage(morph(silhouette, -GLAD_LINE), 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      inMask(ctx, (inner) => {
        const light = inner.createRadialGradient(-6, -8, 2, 0, 0, FACE_RADIUS);
        light.addColorStop(0, WHITE);
        light.addColorStop(0.5, 'rgb(255 255 255 / 0.85)');
        light.addColorStop(1, 'rgb(255 255 255 / 0)');
        inner.fillStyle = light;
        inner.fillRect(-80, -80, 160, 160);
      });
    },
    (ctx) => {
      inMask(
        ctx,
        face.glad ??
          ((inner) => {
            gladFace(inner, { part: 'smile' });
          }),
      );
    },
  ];

  const { canvas, ctx } = canvasOf(BOSS_CELL);
  canvas.width = BOSS_CELL * cells.length;
  cells.forEach((draw, index) => {
    const cell = canvasOf(BOSS_CELL);
    draw(cell.ctx);
    ctx.drawImage(cell.canvas, index * BOSS_CELL, 0);
  });
  const source = new CanvasSource({ resource: canvas, autoGenerateMipmaps: true });
  const radius = FACE_RADIUS * BOSS_SCALE;
  const shapes = cells.map((_, index): Shape => ({
    texture: new Texture({
      source,
      frame: new Rectangle(index * BOSS_CELL, 0, BOSS_CELL, BOSS_CELL),
    }),
    radius,
  }));
  const [band, crack, cracks, light, glad, heart, smile] = shapes;
  if (
    band === undefined ||
    crack === undefined ||
    cracks === undefined ||
    light === undefined ||
    glad === undefined ||
    heart === undefined ||
    smile === undefined
  ) {
    throw new Error('Boss look is missing a texture');
  }
  return {
    band,
    cracks: [crack, cracks],
    light,
    glad,
    heart,
    smile,
    destroy() {
      for (const shape of shapes) {
        shape.texture.destroy(false);
      }
      source.destroy();
    },
  };
}

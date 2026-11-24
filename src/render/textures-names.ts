import { CanvasSource, Texture } from 'pixi.js';

export const LABEL_FONT_PX = 13;
const SCALE = 2;
const EDGE = 1.5;
const FAMILY = '"Space Grotesk", "Readex Pro", system-ui, sans-serif';
const PLATE = { padX: 7, padY: 2, rim: 1.5 };

export interface NameLabel {
  readonly fill: Texture;
  readonly edge: Texture;
}

// The pill under the name of a downed ally: its dark face and its rim, each tinted on its own.
export interface NamePlate {
  readonly face: Texture;
  readonly rim: Texture;
}

export interface NameTextures {
  get(name: string): NameLabel;
  plate(name: string): NamePlate;
  destroy(): void;
}

export const NAME_TEXTURE_SCALE = SCALE;

export const LABEL_PAD = EDGE + 2;

function context2d(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('Canvas 2D context is unavailable');
  }
  return { canvas, ctx };
}

function textureOf(canvas: HTMLCanvasElement): Texture {
  return new Texture({ source: new CanvasSource({ resource: canvas, autoGenerateMipmaps: true }) });
}

function draw(name: string, edge: boolean, weight = 700): Texture {
  const { canvas, ctx } = context2d();
  const font = `${String(weight)} ${String(LABEL_FONT_PX * SCALE)}px ${FAMILY}`;
  ctx.font = font;
  const pad = LABEL_PAD * SCALE;
  canvas.width = Math.ceil(ctx.measureText(name).width) + 2 * pad;
  canvas.height = Math.ceil(LABEL_FONT_PX * 1.4 * SCALE) + 2 * pad;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  if (edge) {
    ctx.lineWidth = 2 * EDGE * SCALE;
    ctx.strokeText(name, canvas.width / 2, canvas.height / 2);
  }
  ctx.fillText(name, canvas.width / 2, canvas.height / 2);
  return textureOf(canvas);
}

function drawPlate(name: string, rim: boolean): Texture {
  const { canvas, ctx } = context2d();
  ctx.font = `700 ${String(LABEL_FONT_PX * SCALE)}px ${FAMILY}`;
  const height = (LABEL_FONT_PX * 1.4 + 2 * PLATE.padY) * SCALE;
  const width = ctx.measureText(name).width + 2 * PLATE.padX * SCALE;
  const line = PLATE.rim * SCALE;
  canvas.width = Math.ceil(width + 2 * line);
  canvas.height = Math.ceil(height + 2 * line);
  ctx.beginPath();
  ctx.roundRect(line, line, width, height, height / 2);
  if (rim) {
    ctx.lineWidth = line;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  return textureOf(canvas);
}

export function createNameTextures(): NameTextures {
  const labels = new Map<string, NameLabel>();
  const plates = new Map<string, NamePlate>();
  return {
    plate(name: string): NamePlate {
      let plate = plates.get(name);
      if (plate === undefined) {
        plate = { face: drawPlate(name, false), rim: drawPlate(name, true) };
        plates.set(name, plate);
      }
      return plate;
    },
    get(name: string): NameLabel {
      let label = labels.get(name);
      if (label === undefined) {
        label = { fill: draw(name, false), edge: draw(name, true) };
        labels.set(name, label);
      }
      return label;
    },
    destroy(): void {
      for (const label of labels.values()) {
        label.fill.destroy(true);
        label.edge.destroy(true);
      }
      for (const plate of plates.values()) {
        plate.face.destroy(true);
        plate.rim.destroy(true);
      }
      labels.clear();
      plates.clear();
    },
  };
}

export interface LineTextures {
  get(text: string, weight: number): Texture;
  destroy(): void;
}

export function createLineTextures(): LineTextures {
  const lines = new Map<string, Texture>();
  return {
    get(text: string, weight: number): Texture {
      const key = `${String(weight)} ${text}`;
      let line = lines.get(key);
      if (line === undefined) {
        line = draw(text, false, weight);
        lines.set(key, line);
      }
      return line;
    },
    destroy(): void {
      for (const line of lines.values()) {
        line.destroy(true);
      }
      lines.clear();
    },
  };
}

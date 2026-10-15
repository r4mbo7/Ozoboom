import { CanvasSource, Texture } from 'pixi.js';

export const LABEL_FONT_PX = 13;
const SCALE = 2;
const EDGE = 1.5;
const FAMILY = '"Space Grotesk", system-ui, sans-serif';

// A name is drawn twice, white: the letters, and the letters thickened to hold a backing or a dark contour.
export interface NameLabel {
  readonly fill: Texture;
  readonly edge: Texture;
}

export interface NameTextures {
  get(name: string): NameLabel;
  destroy(): void;
}

// Textures are painted at SCALE times the size they are shown at, so the label stays crisp on a dense screen.
export const NAME_TEXTURE_SCALE = SCALE;

// Plain letters around which the texture keeps this many logical pixels of room on each side.
export const LABEL_PAD = EDGE + 2;

function draw(name: string, edge: boolean, weight = 700): Texture {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('Canvas 2D context is unavailable');
  }
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
  return new Texture({ source: new CanvasSource({ resource: canvas, autoGenerateMipmaps: true }) });
}

export function createNameTextures(): NameTextures {
  const labels = new Map<string, NameLabel>();
  return {
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
      labels.clear();
    },
  };
}

// White lines of text at the size of the names, without the edge, for a panel that gives them a backing.
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

import { CanvasSource, Texture } from 'pixi.js';

const FONT_PX = 13;
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

function draw(name: string, edge: boolean): Texture {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('Canvas 2D context is unavailable');
  }
  const font = `700 ${String(FONT_PX * SCALE)}px ${FAMILY}`;
  ctx.font = font;
  const pad = (EDGE + 2) * SCALE;
  canvas.width = Math.ceil(ctx.measureText(name).width) + 2 * pad;
  canvas.height = Math.ceil(FONT_PX * 1.4 * SCALE) + 2 * pad;
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

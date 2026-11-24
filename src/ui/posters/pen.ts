import { frac } from '../../shared/scalar';

// The line-up posters are drawn on a 320 x 180 composition, the size of their Lavish drawings, shown
// whole on any screen: what the screen shows past it, on two sides, is the view's margin.
export const POSTER_WIDTH = 320;
export const POSTER_HEIGHT = 180;
export const TAU = Math.PI * 2;

export const TITLE_FONT = '"Cinzel Decorative", "Reem Kufi", Georgia, serif';
export const BODY_FONT = '"Space Grotesk", "Readex Pro", system-ui, sans-serif';

export type Ink = string | CanvasGradient;
export type Point = readonly [number, number];

// A rectangle in units of the composition.
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

// What of the composition the canvas holds, what the screen shows of it, in its units, and how many
// device pixels make one: a poster fills the canvas, and stands its corners on the screen's.
export interface PosterView extends Box {
  readonly screen: Box;
  readonly scale: number;
}

// What a poster prints, in the player's language; the artist's name parts into its two words.
export interface PosterWords {
  readonly track: string;
  readonly stage: string;
  readonly first: string;
  readonly last: string;
  readonly alias: string | null;
}

// The middle of the gap between the two words of the artist's name, where the poster tears.
export interface NameGap {
  readonly x: number;
  readonly y: number;
}

// A text set to print: its font, letter spacing and printed width, in units.
export interface Lettering {
  readonly font: string;
  readonly spacing: number;
  readonly width: number;
}

export type PosterDrawing = (pen: Pen, beat: number, words: PosterWords) => NameGap;

// The view of a canvas `bleed` times as large as the screen, the composition held whole on the screen.
export function posterView(width: number, height: number, bleed = 1): PosterView {
  const scale = Math.min(width / POSTER_WIDTH, height / POSTER_HEIGHT) / bleed;
  const box = (bled: number): Box => {
    const w = width / scale / bled;
    const h = height / scale / bled;
    const left = (POSTER_WIDTH - w) / 2;
    const top = (POSTER_HEIGHT - h) / 2;
    return { left, top, right: left + w, bottom: top + h };
  };
  return { ...box(1), screen: box(bleed), scale };
}

// A light struck on each beat, fading until the next.
export const pulse = (beat: number, k = 5) => Math.exp(-k * frac(beat));

// The same scatter on every frame, from its seed.
export function rng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${String(n >> 16)},${String((n >> 8) & 255)},${String(n & 255)},${String(alpha)})`;
}

// A 2D context set on the composition, and the strokes every poster draws with.
export class Pen {
  readonly g: CanvasRenderingContext2D;
  readonly view: PosterView;

  constructor(g: CanvasRenderingContext2D, view: PosterView) {
    this.g = g;
    this.view = view;
    g.setTransform(view.scale, 0, 0, view.scale, -view.left * view.scale, -view.top * view.scale);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  // The whole screen, past the composition too.
  fill(ink: Ink): void {
    const { left, top, right, bottom } = this.view;
    this.g.fillStyle = ink;
    this.g.fillRect(left, top, right - left, bottom - top);
  }

  alpha(a: number, draw: () => void): void {
    if (a <= 0) {
      return;
    }
    this.g.save();
    this.g.globalAlpha *= a;
    draw();
    this.g.restore();
  }

  // Light added to what is under it.
  lighter(draw: () => void): void {
    this.g.save();
    this.g.globalCompositeOperation = 'lighter';
    draw();
    this.g.restore();
  }

  at(x: number, y: number, rotation: number, scale: number, draw: () => void): void {
    this.g.save();
    this.g.translate(x, y);
    this.g.rotate(rotation);
    this.g.scale(scale, scale);
    draw();
    this.g.restore();
  }

  paint(fill: Ink | null, stroke: Ink | null = null, width = 1.5): void {
    if (fill !== null) {
      this.g.fillStyle = fill;
      this.g.fill();
    }
    if (stroke !== null) {
      this.g.strokeStyle = stroke;
      this.g.lineWidth = width;
      this.g.lineJoin = 'round';
      this.g.stroke();
    }
  }

  circ(
    x: number,
    y: number,
    r: number,
    fill: Ink | null,
    stroke?: Ink | null,
    width?: number,
  ): void {
    this.g.beginPath();
    this.g.arc(x, y, Math.max(0, r), 0, TAU);
    this.paint(fill, stroke, width);
  }

  ell(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    fill: Ink | null,
    stroke?: Ink | null,
    width?: number,
  ): void {
    this.g.beginPath();
    this.g.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rotation, 0, TAU);
    this.paint(fill, stroke, width);
  }

  seg(x1: number, y1: number, x2: number, y2: number, stroke: Ink, width?: number): void {
    this.g.beginPath();
    this.g.moveTo(x1, y1);
    this.g.lineTo(x2, y2);
    this.g.lineCap = 'round';
    this.paint(null, stroke, width);
  }

  arc(x: number, y: number, r: number, from: number, to: number, stroke: Ink, width = 2): void {
    this.g.beginPath();
    this.g.arc(x, y, Math.max(0, r), from, to);
    this.g.lineCap = 'round';
    this.paint(null, stroke, width);
  }

  poly(points: readonly Point[], fill: Ink | null, stroke?: Ink | null, width?: number): void {
    this.g.beginPath();
    for (const [x, y] of points) {
      this.g.lineTo(x, y);
    }
    this.g.closePath();
    this.paint(fill, stroke, width);
  }

  rrect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: Ink | null,
    stroke?: Ink | null,
    width?: number,
  ): void {
    this.g.beginPath();
    this.g.roundRect(x, y, w, h, r);
    this.paint(fill, stroke, width);
  }

  // A four-pointed lozenge, `rx` wide and `ry` high from its centre.
  lozenge(
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill: Ink | null,
    stroke?: Ink | null,
    width?: number,
  ): void {
    this.poly(
      [
        [x, y - ry],
        [x + rx, y],
        [x, y + ry],
        [x - rx, y],
      ],
      fill,
      stroke,
      width,
    );
  }

  glow(x: number, y: number, r: number, color: string, a: number): void {
    if (a <= 0 || r <= 0) {
      return;
    }
    this.lighter(() => {
      this.g.globalAlpha *= a;
      const light = this.g.createRadialGradient(x, y, 0, x, y, r);
      light.addColorStop(0, color);
      light.addColorStop(1, 'rgba(0,0,0,0)');
      this.circ(x, y, r, light);
    });
  }

  // A vertical gradient through `stops`, each an offset and a colour.
  lin(y0: number, y1: number, stops: readonly (readonly [number, string])[]): CanvasGradient {
    const gradient = this.g.createLinearGradient(0, y0, 0, y1);
    for (const [offset, color] of stops) {
      gradient.addColorStop(offset, color);
    }
    return gradient;
  }

  // `text` set in `size` units spaced by `spacing`, shrunk until it holds in `most` units.
  letter(
    text: string,
    weight: number,
    size: number,
    family: string,
    spacing: number,
    most = Infinity,
  ): Lettering {
    const set = (k: number) => {
      this.g.font = `${String(weight)} ${String(size * k)}px ${family}`;
      this.g.letterSpacing = `${String(spacing * k)}px`;
      return this.g.measureText(text).width - spacing * k;
    };
    const width = set(1);
    const k = width > most ? most / width : 1;
    const lettering = {
      font: `${String(weight)} ${String(size * k)}px ${family}`,
      spacing: spacing * k,
      width: k < 1 ? set(k) : width,
    };
    this.g.letterSpacing = '0px';
    return lettering;
  }

  // Lettered text centred on `x` and `y`, the spacing after its last letter left out.
  print(text: string, lettering: Lettering, x: number, y: number, color: Ink): void {
    this.g.font = lettering.font;
    this.g.letterSpacing = `${String(lettering.spacing)}px`;
    this.g.textAlign = 'left';
    this.g.textBaseline = 'middle';
    this.g.fillStyle = color;
    this.g.fillText(text, x - lettering.width / 2, y);
    this.g.letterSpacing = '0px';
  }
}

// An eight-pointed star of two squares, its tip up, turned by `rotation`.
export function star8(x: number, y: number, r: number, rotation = 0, inner = r * 0.7654): Point[] {
  return Array.from({ length: 16 }, (_, i) => {
    const a = rotation - Math.PI / 2 + (i * TAU) / 16;
    const d = i % 2 === 1 ? inner : r;
    return [x + Math.cos(a) * d, y + Math.sin(a) * d] as const;
  });
}

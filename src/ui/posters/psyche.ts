import { clamp01 } from '../../shared/scalar';
import {
  BODY_FONT,
  type NameGap,
  POSTER_WIDTH,
  type Pen,
  type PosterWords,
  TAU,
  TITLE_FONT,
  pulse,
} from './pen';

const W = POSTER_WIDTH;

// The inks of a psychedelic poster: its ground and dark ink, its edge, its two cartouches, and the
// lettering of the name, a face over a dark outline and a coloured extrusion.
export interface PsycheInks {
  readonly base: string;
  readonly ink: string;
  readonly inkSoft: string;
  readonly hush: string;
  readonly edge: string;
  readonly cream: string;
  readonly trackColor: string;
  readonly stageColor: string;
  readonly faceTop: string;
  readonly faceBottom: string;
  readonly band: string;
  readonly inline: string;
  readonly outline: string;
  readonly extrude: string;
  readonly framed?: false;
  readonly trackY?: number;
  readonly stageY?: number;
}

interface Letters {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  readonly pad: number;
  // What it was lettered for: its size, and whether the title font had loaded.
  readonly made: string;
}

const lettered = new WeakMap<PsycheInks, Map<string, Letters>>();

// One word lettered once: colour extrusion, dark outline, then the face with a lower band, a 70s inline.
function letters(word: string, inks: PsycheInks, scale: number): Letters {
  // Lettered as large as it prints, so that it stays sharp on a large screen.
  const size = Math.round(Math.max(160, 60 * scale));
  const ready = document.fonts.check(`900 40px ${TITLE_FONT}`);
  const made = `${String(size)}|${String(ready)}`;
  // One lettering per word, made again when the screen's size or the font changes.
  const cache = lettered.get(inks) ?? new Map<string, Letters>();
  lettered.set(inks, cache);
  const known = cache.get(word);
  if (known?.made === made) {
    return known;
  }
  const k = size / 160;
  const pad = 26 * k;
  const font = `900 ${String(size)}px ${TITLE_FONT}`;
  const probe = document.createElement('canvas').getContext('2d');
  if (probe === null) {
    throw new Error('No 2D context to letter the poster');
  }
  probe.font = font;
  const m = probe.measureText(word);
  const left = m.actualBoundingBoxLeft;
  const width = left + m.actualBoundingBoxRight;
  const ascent = m.actualBoundingBoxAscent;
  const height = ascent + m.actualBoundingBoxDescent;
  const extrusion = 10 * k;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width + pad * 2 + extrusion);
  canvas.height = Math.ceil(height + pad * 2 + extrusion);
  const face = document.createElement('canvas');
  face.width = canvas.width;
  face.height = canvas.height;
  const o = canvas.getContext('2d');
  const f = face.getContext('2d');
  if (o === null || f === null) {
    throw new Error('No 2D context to letter the poster');
  }
  const bx = pad + left;
  const by = pad + ascent;
  o.font = font;
  o.textBaseline = 'alphabetic';
  o.lineJoin = 'round';
  const draw = (dx: number, dy: number, color: string, line: number) => {
    o.lineWidth = line;
    o.strokeStyle = color;
    o.strokeText(word, bx + dx, by + dy);
    o.fillStyle = color;
    o.fillText(word, bx + dx, by + dy);
  };
  for (let step = extrusion; step > 0; step -= 2 * k) {
    draw(step, step, inks.extrude, 14 * k);
  }
  draw(0, 0, inks.outline, 13 * k);
  f.font = font;
  f.textBaseline = 'alphabetic';
  const gradient = f.createLinearGradient(0, pad, 0, pad + height);
  gradient.addColorStop(0, inks.faceTop);
  gradient.addColorStop(1, inks.faceBottom);
  f.fillStyle = gradient;
  f.fillText(word, bx, by);
  f.globalCompositeOperation = 'source-atop';
  f.fillStyle = inks.band;
  f.fillRect(0, pad + height * 0.64, face.width, height * 0.07);
  f.globalCompositeOperation = 'source-over';
  f.lineWidth = 2.5 * k;
  f.strokeStyle = inks.inline;
  f.strokeText(word, bx, by);
  o.drawImage(face, 0, 0);
  const lettering = { canvas, width, height, pad, made };
  cache.set(word, lettering);
  return lettering;
}

// A word warped into x0..x0 + span: its height swells to its middle, its baseline rides a wave.
function wavy(
  p: Pen,
  word: Letters,
  x0: number,
  span: number,
  cy: number,
  h0: number,
  beat: number,
): void {
  const hx = span / word.width;
  const breathe = 1 + 0.03 * pulse(beat, 5);
  const step = 2 * (word.pad / 26);
  for (let px = 0; px < word.canvas.width; px += step) {
    const u = clamp01((px - word.pad) / word.width);
    const v = (h0 * (0.6 + 0.46 * Math.sin(Math.PI * u)) * breathe) / word.height;
    const x = x0 + (px - word.pad) * hx;
    const yc = cy + 3.6 * Math.sin((TAU * x) / 190 - (TAU * beat) / 4);
    const top = yc - (word.height / 2 + word.pad) * v;
    p.g.drawImage(
      word.canvas,
      px,
      0,
      step,
      word.canvas.height,
      x,
      top,
      step * hx + 0.06,
      word.canvas.height * v,
    );
  }
}

function name(p: Pen, words: PosterWords, inks: PsycheInks, beat: number, cy: number): NameGap {
  const a = letters(words.first.toUpperCase(), inks, p.view.scale);
  const b = letters(words.last.toUpperCase(), inks, p.view.scale);
  const total = 272;
  const gap = 24;
  const wa = ((total - gap) * a.width) / (a.width + b.width);
  const x0 = (W - total) / 2;
  wavy(p, a, x0, wa, cy, 50, beat);
  wavy(p, b, x0 + wa + gap, total - gap - wa, cy, 50, beat);
  return { x: x0 + wa + gap / 2, y: cy };
}

// A cartouche: a pill in the poster's dark ink, a double hairline, spaced capitals.
function cartouche(
  p: Pen,
  text: string,
  y: number,
  inks: PsycheInks,
  spacing: number,
  color: string,
): void {
  const lettering = p.letter(text, 700, 10, BODY_FONT, spacing, 250);
  const bw = lettering.width + 18;
  const bh = 19;
  p.rrect(W / 2 - bw / 2, y - bh / 2, bw, bh, bh / 2, inks.ink, inks.edge, 0.9);
  p.rrect(W / 2 - bw / 2 + 2, y - bh / 2 + 2, bw - 4, bh - 4, bh / 2 - 2, null, inks.edge, 0.4);
  p.print(text, lettering, W / 2, y + 0.5, color);
}

function aka(p: Pen, text: string, y: number, inks: PsycheInks): void {
  const lettering = p.letter(text, 700, 9.5, BODY_FONT, 0.8, 250);
  p.rrect(W / 2 - lettering.width / 2 - 7, y - 7, lettering.width + 14, 14, 7, inks.inkSoft);
  p.print(text, lettering, W / 2, y + 0.5, inks.cream);
}

// A soft pool of the poster's ink behind the lettering, so the pattern never fights the name.
function hush(p: Pen, inks: PsycheInks, cy: number): void {
  p.g.save();
  p.g.translate(W / 2, cy);
  p.g.scale(1, 0.42);
  const pool = p.g.createRadialGradient(0, 0, 10, 0, 0, 165);
  pool.addColorStop(0, inks.hush);
  pool.addColorStop(1, 'rgba(0,0,0,0)');
  p.g.fillStyle = pool;
  p.g.fillRect(-170, -170, 340, 340);
  p.g.restore();
}

// A double frame along the screen's edges, a stud in each corner.
function frame(p: Pen, inks: PsycheInks): void {
  const { left, top, right, bottom } = p.view.screen;
  const w = right - left;
  const h = bottom - top;
  p.rrect(left + 5, top + 5, w - 10, h - 10, 3, null, inks.edge, 0.8);
  p.rrect(left + 7.5, top + 7.5, w - 15, h - 15, 2, null, inks.edge, 0.35);
  for (const [x, y] of [
    [left + 5, top + 5],
    [right - 5, top + 5],
    [left + 5, bottom - 5],
    [right - 5, bottom - 5],
  ] as const) {
    p.circ(x, y, 2.2, inks.edge, inks.ink, 0.6);
  }
}

// A 60s-70s concert poster: the artist's name in swelling wavy letters over a pattern of the stage.
export function psychePoster(
  p: Pen,
  beat: number,
  words: PosterWords,
  inks: PsycheInks,
  pattern: () => void,
): NameGap {
  p.fill(inks.base);
  pattern();
  hush(p, inks, 84);
  if (inks.framed !== false) {
    frame(p, inks);
  }
  const gap = name(p, words, inks, beat, 84);
  cartouche(p, words.track.toUpperCase(), inks.trackY ?? 26, inks, 2.6, inks.trackColor);
  if (words.alias !== null) {
    aka(p, words.alias, 128, inks);
  }
  cartouche(p, words.stage.toUpperCase(), inks.stageY ?? 153, inks, 3, inks.stageColor);
  return gap;
}

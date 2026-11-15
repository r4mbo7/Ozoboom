import { nextFloat, seedRng } from '../shared/prng';
import { clamp, clamp01, lerp, smoothstep } from '../shared/scalar';
import { DEFAULT_BPM } from '../shared/tempo';
import type { ThanksShown } from './title-thanks';

export interface ThanksPainter {
  // Each frame on the title; `position` is the ambience position in eighths, which sways the water.
  paint(shown: ThanksShown | null, calm: boolean, position: number): void;
}

interface Span {
  readonly left: number;
  readonly right: number;
}

interface Line {
  readonly text: string;
  readonly size: number;
  readonly weight: number;
  readonly y: number;
  readonly width: number;
}

interface Letter {
  readonly char: string;
  readonly x: number;
  readonly line: Line;
  readonly at: number;
  readonly fly: Fly;
}

interface Fly {
  x: number;
  y: number;
  // Where it flies this frame.
  nowX: number;
  nowY: number;
  alpha: number;
  flash: number;
  readonly at: number;
  readonly rise: number;
  readonly sway: number;
  readonly end: number;
}

interface Hover {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly delay: number;
  // Where it is this frame, and the ring it left on the water.
  x: number;
  y: number;
  alpha: number;
  ring: number;
}

export interface ThanksLayout {
  readonly side: 'left' | 'right';
  readonly x: number;
  readonly lines: readonly Line[];
  readonly top: number;
  readonly bottom: number;
  readonly scale: number;
  readonly origin: readonly [number, number];
  readonly block: readonly [number, number];
  readonly letters: readonly Letter[];
  readonly flies: readonly Fly[];
  readonly hovers: readonly Hover[];
}

interface Inks {
  readonly cream: string;
  readonly turquoise: string;
  readonly gold: string;
  readonly font: string;
}

type Context = CanvasRenderingContext2D;

// What the strokes on the water need of a canvas.
export type Pen = Pick<
  Context,
  | 'globalAlpha'
  | 'strokeStyle'
  | 'lineWidth'
  | 'lineCap'
  | 'beginPath'
  | 'ellipse'
  | 'moveTo'
  | 'lineTo'
  | 'stroke'
>;

export type Measure = (text: string, size: number, weight: number) => number;

// A layout and the two pictures of its name, cream and gold, at the screen's pixel ratio.
interface Drawn {
  readonly layout: ThanksLayout;
  readonly image: HTMLCanvasElement;
  readonly gold: HTMLCanvasElement;
  readonly dpr: number;
}

// Every distance is drawn for a 34 px name and follows its size.
const NAME_SIZE = 34;
const MIN_SIZE = 15;
const MIN_LANE = 120;
const LANE_PAD = 24;
const FOOT = 84;
const STRIP = 3;
const LETTER_FLIES = 7;
const HOVER_FLIES = 5;
const SECONDS_PER_EIGHTH = 60 / DEFAULT_BPM;
// The life of a name over its 4 bars, in eighths: the fireflies rise, the name surfaces under them,
// holds, then its letters gather into fireflies from the first to the last, which go out by the end.
const RISE = 6.4;
const SURFACE: Span = { left: 5, right: 11 };
const BREAK: Span = { left: 17, right: 21.6 };
const FLIGHT = 7.6;
const UNDERLINES = [-0.55, 0, 0.5];

const progress = (value: number, from: number, to: number) => clamp01((value - from) / (to - from));
const fontOf = (weight: number, size: number, family: string) =>
  `${String(weight)} ${String(size)}px ${family}`;

// Latin letters fly off one by one; a joined script leaves whole, its letters keeping their shapes.
function piecesOf(text: string): string[] {
  return /[\u0590-\u08ff\ufb1d-\ufefc]/.test(text)
    ? [text]
    : [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(
        ({ segment }) => segment,
      );
}

function inksOf(canvas: HTMLCanvasElement): Inks {
  const style = getComputedStyle(canvas);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    cream: token('--texte'),
    turquoise: token('--turquoise'),
    gold: token('--noyau'),
    font: style.fontFamily,
  };
}

// The name breaks on a space into two lines of about the same width, or shrinks, to fit its lane.
function fitLines(
  measure: Measure,
  label: string,
  name: string,
  room: number,
  height: number,
): { texts: string[]; size: number } | null {
  const words = name.split(' ');
  const splits = [
    [name],
    ...words
      .slice(1)
      .map((_, at) => [words.slice(0, at + 1).join(' '), words.slice(at + 1).join(' ')]),
  ];
  const widest = (texts: string[], size: number) =>
    Math.max(measure(label, size * 0.55, 600), ...texts.map((text) => measure(text, size, 700)));
  const base = Math.min(NAME_SIZE, height * 0.077);
  if (base < MIN_SIZE) {
    return null;
  }
  for (const size of [base, MIN_SIZE]) {
    const fitting = splits
      .filter((texts) => widest(texts, size) <= room)
      .sort((a, b) => a.length - b.length || widest(a, size) - widest(b, size));
    const best = fitting[0];
    if (best !== undefined) {
      return {
        texts: best,
        size: size === base ? base : Math.min(base, room / (widest(best, 1) || 1)),
      };
    }
  }
  return null;
}

function drawBlock(
  layout: ThanksLayout,
  inks: Inks,
  fill: (line: Line, context: Context) => string | CanvasGradient,
  dpr: number,
): HTMLCanvasElement {
  const [width, height] = layout.block;
  const [left, top] = layout.origin;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  const context = canvas.getContext('2d');
  if (context === null) {
    return canvas;
  }
  context.scale(dpr, dpr);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const line of layout.lines) {
    context.font = fontOf(line.weight, line.size, inks.font);
    context.shadowColor = inks.turquoise;
    context.shadowBlur = line.size * 0.15;
    context.fillStyle = fill(line, context);
    context.fillText(line.text, layout.x - left, line.y - top);
  }
  return canvas;
}

function drawn(layout: ThanksLayout, inks: Inks, dpr: number): Drawn {
  const fade = (line: Line, context: Context) => {
    const top = line.y - layout.origin[1];
    const gradient = context.createLinearGradient(0, top - line.size / 2, 0, top + line.size / 2);
    gradient.addColorStop(0, inks.cream);
    gradient.addColorStop(0.45, inks.cream);
    gradient.addColorStop(1, inks.turquoise);
    return gradient;
  };
  return {
    layout,
    image: drawBlock(layout, inks, fade, dpr),
    gold: drawBlock(layout, inks, () => inks.gold, dpr),
    dpr,
  };
}

// Where the name, its letters and its fireflies go in a lane of the lake `height` tall; null when
// the name cannot fit there.
export function layThanks(
  shown: ThanksShown,
  measure: Measure,
  lane: Span,
  height: number,
): ThanksLayout | null {
  const room = lane.right - lane.left - 2 * LANE_PAD;
  if (room < MIN_LANE - 2 * LANE_PAD) {
    return null;
  }
  const fit = fitLines(measure, shown.thanks.label, shown.thanks.name, room, height);
  if (fit === null) {
    return null;
  }
  const { size } = fit;
  const scale = size / NAME_SIZE;
  const label = { text: shown.thanks.label, size: size * 0.55, weight: 600 };
  const steps = [0, ...fit.texts.map((_, index) => size * (0.95 + 1.25 * index))];
  const tall = steps.at(-1) ?? 0;
  const centre = clamp(height * 0.42, tall / 2 + 50 * scale, height - FOOT - tall / 2);
  if (centre + tall / 2 > height - FOOT + 1) {
    return null;
  }
  const x = (lane.left + lane.right) / 2;
  const lines: Line[] = [label, ...fit.texts.map((text) => ({ text, size, weight: 700 }))].map(
    (line, index) => ({
      ...line,
      y: centre - tall / 2 + (steps[index] ?? 0),
      width: measure(line.text, line.size, line.weight),
    }),
  );
  const top = centre - tall / 2 - size / 2;
  const bottom = centre + tall / 2 + size / 2;
  const blockWidth = Math.max(...lines.map((line) => line.width)) + 2 * size;
  const origin: [number, number] = [x - blockWidth / 2, top - size / 2];
  const blockHeight = bottom - top + size;
  const rng = seedRng((shown.slot * 7919 + shown.thanks.name.length) >>> 0);
  const random = () => nextFloat(rng);

  const flies: Fly[] = Array.from({ length: LETTER_FLIES }, (_, index) => ({
    x: 0,
    y: 0,
    nowX: 0,
    nowY: 0,
    alpha: 0,
    flash: 1,
    at: BREAK.left + (index / (LETTER_FLIES - 1)) * (BREAK.right - BREAK.left) + random() * 0.4,
    rise: 0.55 + random() * 0.4,
    sway: random() * Math.PI * 2,
    end: 6 + random() * 24 * scale,
  }));
  const placed = lines.flatMap((line) => {
    const left = x - line.width / 2;
    let before = '';
    return piecesOf(line.text).flatMap((char) => {
      const start = measure(before, line.size, line.weight);
      before += char;
      return char.trim() === ''
        ? []
        : [{ char, line, x: left + (start + measure(before, line.size, line.weight)) / 2 }];
    });
  });
  // The letters gather in reading order, a run of them per firefly; a short name lights fewer.
  const letters: Letter[] = [];
  const lit = flies.filter((fly, index) => {
    const run = placed.slice(
      Math.floor((index * placed.length) / LETTER_FLIES),
      Math.floor(((index + 1) * placed.length) / LETTER_FLIES),
    );
    fly.x = run.reduce((sum, letter) => sum + letter.x, 0) / run.length;
    fly.y = run.reduce((sum, letter) => sum + letter.line.y, 0) / run.length - 6 * scale;
    letters.push(...run.map((letter) => ({ ...letter, fly, at: fly.at + random() * 0.6 })));
    return run.length > 0;
  });
  const span = blockWidth - 2 * size;
  const hovers = Array.from({ length: HOVER_FLIES }, (_, index): Hover => {
    const arc = Math.sin((Math.PI * index) / (HOVER_FLIES - 1));
    return {
      from: [
        clamp(x + (random() - 0.5) * room, lane.left + 8, lane.right - 8),
        Math.min(bottom + (40 + random() * 60) * scale, height - 24),
      ],
      to: [
        x + (index / (HOVER_FLIES - 1) - 0.5) * span + (random() - 0.5) * 30 * scale,
        Math.max(top - (22 + 12 * arc) * scale + (random() - 0.5) * 20 * scale, 12),
      ],
      delay: index * 0.5,
      x: 0,
      y: 0,
      alpha: 0,
      ring: 0,
    };
  });

  return {
    side: shown.side,
    x,
    lines,
    top,
    bottom,
    scale,
    origin,
    block: [blockWidth, blockHeight],
    letters,
    flies: lit,
    hovers,
  };
}

function glow(
  context: Context,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  color: string,
): void {
  if (alpha <= 0) {
    return;
  }
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, `${color}00`);
  context.globalAlpha = clamp01(alpha);
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, 2 * radius, 2 * radius);
}

function firefly(
  context: Context,
  inks: Inks,
  shown: ThanksLayout,
  x: number,
  y: number,
  alpha: number,
  flash: number,
): void {
  if (alpha <= 0) {
    return;
  }
  const scale = Math.max(shown.scale, 0.6);
  glow(context, x, y, 30 * scale * flash, 0.65 * alpha, inks.gold);
  glow(context, x, y, 10 * scale, 0.8 * alpha, inks.cream);
  context.globalAlpha = clamp01(alpha);
  context.fillStyle = inks.cream;
  context.beginPath();
  context.arc(x, y, 3 * scale, 0, Math.PI * 2);
  context.fill();
}

// Each strip of the reflection is pushed aside by the swell, the less the more it has surfaced.
function reflection(
  context: Context,
  { layout: shown, dpr }: Drawn,
  image: HTMLCanvasElement,
  alpha: number,
  sway: number,
  time: number,
): void {
  if (alpha <= 0) {
    return;
  }
  const [left, top] = shown.origin;
  const [width, height] = shown.block;
  const band = 0.07 + 0.2 * Math.min(1, sway / 20);
  for (let y = 0; y < height; y += STRIP) {
    const shift =
      sway * Math.sin((y + top) * 0.09 + time * 2.4) +
      0.6 * sway * Math.sin((y + top) * 0.23 - time * 3.1);
    context.globalAlpha = clamp01(alpha * (1 - band * (1 - Math.cos((y + top) * 0.6 + time * 4))));
    context.drawImage(
      image,
      0,
      y * dpr,
      image.width,
      STRIP * dpr,
      left + shift,
      top + y,
      width,
      STRIP,
    );
  }
}

export interface NamePhase {
  // From the flat lake to the name risen, 0 to 1.
  readonly surfaced: number;
  // The name as it stands before its letters leave, 0 to 1.
  readonly held: number;
  // Cream to gold, just before the letters leave.
  readonly warm: number;
  // How far the swell pushes the strips of the reflection aside, in pixels.
  readonly sway: number;
}

export function namePhaseAt(at: number): NamePhase {
  const surfaced = smoothstep(progress(at, SURFACE.left, SURFACE.right));
  return {
    surfaced,
    held: surfaced * (1 - progress(at, BREAK.left, BREAK.right)),
    warm: smoothstep(progress(at, BREAK.left - 2.6, BREAK.left)),
    sway: 0.8 + 34 * (1 - surfaced),
  };
}

// Where a letter is as it flies off: it shrinks into its firefly and goes out on reaching it.
export function letterAt(
  letter: Letter,
  at: number,
  time: number,
): { x: number; y: number; size: number; alpha: number } {
  const gone = smoothstep(progress(at, letter.at, letter.at + 1.6));
  const sway = 0.8 * Math.sin(letter.line.y * 0.09 + time * 2.4);
  return {
    x: lerp(letter.x + sway, letter.fly.x, gone),
    y: lerp(letter.line.y, letter.fly.y, gone),
    size: letter.line.size * (1 - 0.8 * gone),
    alpha: 1 - gone * gone,
  };
}

function paintCalm(context: Context, { layout, image }: Drawn, at: number): void {
  const { surfaced } = namePhaseAt(at);
  context.globalAlpha = surfaced * (1 - smoothstep(progress(at, BREAK.left, BREAK.right)));
  context.drawImage(image, ...layout.origin, ...layout.block);
}

// Moves the fireflies to `at` eighths into the 4 bars: a few rise from the lake and hover over the
// name, then leave for the horizon; the letters' own light up as their letters break and follow.
export function moveThanks(shown: ThanksLayout, at: number, time: number): void {
  const side = shown.side === 'left' ? -1 : 1;
  const { scale } = shown;
  shown.hovers.forEach((hover, index) => {
    const { from, to, delay } = hover;
    const rise = smoothstep(progress(at, 0.4 + delay, RISE + delay));
    const leave =
      progress(at, BREAK.left + 3.8 + delay * 0.5, BREAK.left + 11.4 + delay * 0.5) ** 2;
    hover.x =
      lerp(from[0], to[0], rise) +
      Math.sin(rise * Math.PI * 1.5 + index * 2.1) * 26 * scale * (1 - rise) +
      Math.sin(time * 0.9 + index * 1.9) * 6 * scale +
      leave * (side * 30 + Math.sin(leave * 4 + index) * 20) * scale;
    hover.y =
      lerp(lerp(from[1], to[1], rise), 10, leave) + Math.cos(time * 0.75 + index * 2.7) * 5 * scale;
    hover.alpha =
      progress(at, 0.4 + delay, 2.4 + delay) *
      (1 - progress(at, BREAK.left + 6 + delay * 0.5, BREAK.left + 11.4 + delay * 0.5)) *
      (0.75 + 0.25 * Math.sin(time * 2.2 + index * 1.7));
    hover.ring = progress(at, 0.4 + delay, 4.4 + delay);
  });
  shown.flies.forEach((fly, index) => {
    const flight = progress(at, fly.at + 1.2, fly.at + 1.2 + FLIGHT);
    const eased = 1 - (1 - flight) * (1 - flight);
    fly.nowY = lerp(fly.y, fly.end, eased * fly.rise + (1 - fly.rise) * flight);
    fly.nowX =
      fly.x +
      Math.sin(flight * 5 + fly.sway) * 18 * scale * flight +
      Math.sin(time * 0.9 + index * 1.9) * 3;
    fly.flash = 1 + 0.8 * Math.max(0, 1 - Math.abs(at - fly.at - 1.2) / 1.2);
    fly.alpha =
      progress(at, fly.at + 0.6, fly.at + 1.6) *
      (1 - smoothstep(progress(flight, 0.7, 1))) *
      (0.72 + 0.28 * Math.sin(time * 2.2 + index * 1.7));
  });
}

// The ring each firefly leaves on the water as it rises from it.
export function paintRings(context: Pen, gold: string, shown: ThanksLayout): void {
  context.strokeStyle = gold;
  context.lineWidth = 1.4;
  for (const { from, ring } of shown.hovers) {
    if (ring > 0 && ring < 1) {
      context.globalAlpha = 0.45 * (1 - ring);
      context.beginPath();
      context.ellipse(
        from[0],
        from[1],
        (6 + 22 * ring) * shown.scale,
        (2 + 6 * ring) * shown.scale,
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
  }
}

// The turquoise streaks the name rises from, then the light on the water under it.
export function paintWater(context: Pen, shown: ThanksLayout, at: number, time: number): void {
  const { scale } = shown;
  const { surfaced, held } = namePhaseAt(at);
  const segment = (from: number, to: number, y: number) => {
    context.beginPath();
    context.moveTo(from, y);
    context.lineTo(to, y);
    context.stroke();
  };
  context.lineCap = 'round';
  const streaks = 0.8 * (1 - surfaced) * progress(at, SURFACE.left - 1, SURFACE.left);
  if (streaks > 0) {
    context.globalAlpha = streaks;
    context.lineWidth = 2.2 * scale;
    for (const line of shown.lines) {
      for (let y = line.y - line.size / 2 + 3; y < line.y + line.size / 2; y += 9 * scale) {
        const shift = 18 * scale * Math.sin(y * 0.11 + time * 2.1);
        const reach = (line.width / 2) * (0.35 + 0.6 * (Math.abs(Math.sin(y * 12.9) * 43.7) % 1));
        segment(shown.x - reach + shift, shown.x + reach + shift, y);
      }
    }
  }
  if (held > 0) {
    context.globalAlpha = 0.45 * held;
    context.lineWidth = 2 * scale;
    UNDERLINES.forEach((offset, index) => {
      const x = shown.x + offset * 150 * scale + 6 * scale * Math.sin(time * 0.9 + index * 2.1);
      segment(x - 34 * scale, x + 34 * scale, shown.bottom + 12 * scale + (index % 2) * 7 * scale);
    });
  }
}

// From the first letter to the last, each shrinks into the firefly of its group.
function paintLetters(
  context: Context,
  inks: Inks,
  shown: ThanksLayout,
  at: number,
  time: number,
): void {
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = inks.gold;
  for (const letter of shown.letters) {
    const { x, y, size, alpha } = letterAt(letter, at, time);
    if (alpha > 0) {
      context.globalAlpha = alpha;
      context.font = fontOf(letter.line.weight, size, inks.font);
      context.fillText(letter.char, x, y);
    }
  }
}

function paintLive(context: Context, inks: Inks, picture: Drawn, at: number, time: number): void {
  const shown = picture.layout;
  const { surfaced, held, warm, sway } = namePhaseAt(at);
  moveThanks(shown, at, time);
  paintRings(context, inks.gold, shown);
  const centre = (shown.top + shown.bottom) / 2;
  for (const { x, alpha } of shown.hovers) {
    glow(context, x, centre, 70 * shown.scale, 0.16 * alpha * held, inks.gold);
  }
  context.strokeStyle = inks.turquoise;
  paintWater(context, shown, at, time);
  if (at < BREAK.left) {
    reflection(context, picture, picture.image, surfaced * (1 - warm), sway, time);
    reflection(context, picture, picture.gold, surfaced * warm, sway, time);
  } else {
    paintLetters(context, inks, shown, at, time);
  }
  for (const fly of shown.flies) {
    firefly(context, inks, shown, fly.nowX, fly.nowY, fly.alpha, fly.flash);
  }
  for (const { x, y, alpha } of shown.hovers) {
    firefly(context, inks, shown, x, y, alpha, 1);
  }
}

// The water between the edge of the screen and the menu, on one side, in the canvas's pixels.
export function laneBeside(
  side: 'left' | 'right',
  menu: { readonly left: number; readonly right: number },
  canvas: { readonly left: number; readonly width: number },
): Span {
  return side === 'left'
    ? { left: 0, right: menu.left - canvas.left }
    : { left: menu.right - canvas.left, right: canvas.width };
}

export function createThanksPainter(canvas: HTMLCanvasElement, menu: HTMLElement): ThanksPainter {
  let context: Context | null = null;
  let picture: Drawn | null = null;
  let inks: Inks | null = null;
  let tried: number | null = null;
  let painted = false;
  // A new size or pixel ratio lays the name out again, in its new lane.
  new ResizeObserver(() => {
    tried = null;
  }).observe(canvas);

  function prepare(shown: ThanksShown): Drawn | null {
    const ctx = (context ??= canvas.getContext('2d'));
    if (ctx === null) {
      return null;
    }
    const box = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const [width, height] = [Math.round(box.width * dpr), Math.round(box.height * dpr)];
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ink = inksOf(canvas);
    inks = ink;
    const measure: Measure = (text, size, weight) => {
      ctx.font = fontOf(weight, size, ink.font);
      return ctx.measureText(text).width;
    };
    const layout = layThanks(
      shown,
      measure,
      laneBeside(shown.side, menu.getBoundingClientRect(), box),
      box.height,
    );
    return layout === null ? null : drawn(layout, ink, dpr);
  }

  function clear(): void {
    if (context !== null && painted) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      painted = false;
    }
  }

  return {
    paint(shown, calm, position) {
      if (shown === null) {
        picture = null;
        tried = null;
        clear();
        return;
      }
      if (tried !== shown.slot) {
        tried = shown.slot;
        picture = prepare(shown);
      }
      clear();
      if (picture === null || context === null || inks === null) {
        return;
      }
      context.setTransform(picture.dpr, 0, 0, picture.dpr, 0, 0);
      painted = true;
      if (calm) {
        paintCalm(context, picture, shown.at);
      } else {
        paintLive(context, inks, picture, shown.at, position * SECONDS_PER_EIGHTH);
      }
      context.globalAlpha = 1;
    },
  };
}

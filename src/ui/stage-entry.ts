import './stage-entry.css';
import { CREDITS } from '../data/credits';
import { t } from '../shared/i18n';
import type { Vec2 } from '../sim/state';
import { el } from './dom';
import { posterDrawing } from './posters';
import { Pen, type PosterDrawing, type PosterWords, posterView } from './posters/pen';
import type { EntryPoster } from './types';

// The beats of the entry the poster plays on: torn, its halves flown off as the CSS times them,
// and the overlay gone.
const BEATS = { tear: 4, flown: 5.1, gone: 9.5 };
// The beat a still poster holds, in calm mode: its light just struck.
const STILL_BEAT = 1;
// The tear runs down in steps, jagged, straighter across the name it parts.
const TEAR_STEPS = 21;
const TEAR_JAG = [0.6, -0.4, 0.9, -0.8, 0.3, -0.6, 1, -0.2, 0.7, -0.9, 0.4];

// The credited name of the artist, large, and the alias it goes by, small; the whole name large
// without one.
export function artistLines(credit: string): { name: string; alias: string | null } {
  const [name = credit, alias] = credit.split(/\s+aka\s+/);
  return { name, alias: alias === undefined ? null : `aka ${alias}` };
}

function posterWords(entry: EntryPoster): PosterWords {
  const { name, alias } = artistLines(CREDITS.music.name);
  const [first = name, ...rest] = name.split(' ');
  return { track: t(entry.track), stage: t(entry.stage), first, last: rest.join(' '), alias };
}

// The jagged line of the tear at `x`, a share of the poster's width, as the points of a clip path
// from the top down, straighter across the name at `y`; `side` -1 keeps the start half, 1 the end.
function tearPath(x: number, y: number, side: -1 | 1): string {
  const points: string[] = [];
  for (let step = 0; step <= TEAR_STEPS; step += 1) {
    const at = (step / TEAR_STEPS) * 104 - 2;
    const jag = (TEAR_JAG[step % TEAR_JAG.length] ?? 0) * (Math.abs(at - y * 100) < 12 ? 0.4 : 1.6);
    points.push(`${(x * 100 + jag).toFixed(2)}% ${at.toFixed(2)}%`);
  }
  const edge = side < 0 ? '-10%' : '110%';
  return `polygon(${edge} -2%, ${points.join(', ')}, ${edge} 102%)`;
}

// Sizes the canvas to its box in device pixels, and says whether its size changed.
function fitted(canvas: HTMLCanvasElement, box: DOMRect): boolean {
  const density = Math.min(2, window.devicePixelRatio);
  const width = Math.round(box.width * density);
  const height = Math.round(box.height * density);
  if (canvas.width === width && canvas.height === height) {
    return false;
  }
  canvas.width = width;
  canvas.height = height;
  return true;
}

export interface EntryOverlay {
  readonly element: HTMLElement;
  // Each frame of the game: plays the entry of the frame, placing its landing on the stage, and says
  // whether the game still waits for its landing.
  update(
    entry: EntryPoster | null,
    stage: Vec2,
    toScreen: ((point: Vec2) => Vec2) | undefined,
  ): boolean;
}

// The line-up poster of the run, drawn on the beat (still in calm mode), torn on the second bar,
// then "Let's go" on the stage at the landing, each timed by CSS from the beat of the entry.
export function createEntryOverlay(now: () => number, calm: () => boolean): EntryOverlay {
  const element = el('div', 'ui-entry');
  element.hidden = true;
  let shown: EntryPoster | null = null;
  let mark: HTMLElement | null = null;
  // The whole poster, and its copies in the two halves the tear parts.
  let whole: HTMLCanvasElement | null = null;
  let copies: HTMLCanvasElement[] = [];
  let drawing: PosterDrawing | null = null;
  let words: PosterWords | null = null;
  let settled = false;
  // Where the tear parts the poster, in shares of its width and height.
  let tearAt = { x: 0.5, y: 0.5 };
  let copied = false;

  function build(entry: EntryPoster): void {
    element.replaceChildren();
    element.style.setProperty('--entry-beat', `${String(entry.beatMs)}ms`);
    element.style.setProperty('--entry-since', `${String(now() - entry.startsAt)}ms`);
    drawing = posterDrawing(entry.poster);
    words = posterWords(entry);
    const sheet = el('div', 'ui-entry__sheet');
    whole = el('canvas', 'ui-entry__poster');
    whole.setAttribute('role', 'img');
    whole.setAttribute(
      'aria-label',
      [words.track, `${words.first} ${words.last}`, words.alias, words.stage]
        .filter((line) => line !== null)
        .join(', '),
    );
    sheet.append(whole);
    copies = ['start', 'end'].map((side) => {
      const half = el('div', `ui-entry__half ui-entry__half--${side}`);
      half.setAttribute('aria-hidden', 'true');
      const copy = el('canvas', 'ui-entry__poster');
      half.append(copy);
      sheet.append(half);
      return copy;
    });
    const marker = el('div', 'ui-entry__mark');
    marker.setAttribute('aria-hidden', 'true');
    marker.append(el('span', 'ui-entry__burst'), el('span', 'ui-entry__go', t("Let's go")));
    mark = marker;
    element.append(sheet, marker, el('div', 'ui-entry__flash'));
    element.hidden = false;
    settled = false;
    copied = false;
  }

  // Draws the poster at `beat`, and from just before the tear parts its halves between the two
  // words of the artist's name.
  function draw(beat: number): void {
    if (whole === null || drawing === null || words === null || beat >= BEATS.flown) {
      return;
    }
    const box = whole.getBoundingClientRect();
    if (box.width === 0) {
      return;
    }
    const resized = fitted(whole, box);
    const repaint = !settled || resized || !calm();
    if (repaint) {
      const g = whole.getContext('2d');
      if (g === null) {
        throw new Error('No 2D context to draw the line-up poster');
      }
      // The sheet is a little larger than the screen, so that it can shake.
      const view = posterView(whole.width, whole.height, box.width / whole.offsetWidth);
      const gap = drawing(new Pen(g, view), calm() ? STILL_BEAT : beat, words);
      settled = document.fonts.status === 'loaded';
      tearAt = {
        x: (gap.x - view.left) / (view.right - view.left),
        y: (gap.y - view.top) / (view.bottom - view.top),
      };
    }
    if (beat < BEATS.tear - 0.25 || (!repaint && copied)) {
      return;
    }
    for (const [index, copy] of copies.entries()) {
      if (copy.width !== whole.width || copy.height !== whole.height) {
        copy.width = whole.width;
        copy.height = whole.height;
      }
      copy.getContext('2d')?.drawImage(whole, 0, 0);
      copy.style.clipPath = tearPath(tearAt.x, tearAt.y, index === 0 ? -1 : 1);
    }
    copied = true;
  }

  return {
    element,
    update(entry, stage, toScreen) {
      const time = now();
      const over = entry === null || time >= entry.startsAt + BEATS.gone * entry.beatMs;
      if (over) {
        if (shown !== null) {
          shown = null;
          element.hidden = true;
          element.replaceChildren();
          // Lets the three screen-sized canvases go for the rest of the run.
          whole = null;
          copies = [];
        }
        return false;
      }
      if (entry !== shown) {
        shown = entry;
        build(entry);
      }
      draw((time - entry.startsAt) / entry.beatMs);
      const point = toScreen?.(stage) ?? null;
      if (mark !== null && point !== null) {
        mark.style.translate = `${point.x.toFixed(1)}px ${point.y.toFixed(1)}px`;
      }
      return time < entry.landsAt;
    },
  };
}

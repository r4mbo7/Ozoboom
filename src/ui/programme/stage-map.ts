import './stage-map.css';
import { el, icon } from '../dom';
import { LOCK } from '../icons';
import { createPortrait } from './portrait';
import {
  SITE_RATIO,
  SITE_STOPS,
  SITE_VIEW_BOX,
  type Point,
  lengthOf,
  pinTip,
  pointAlong,
  route,
  shareOf,
  siteTerrain,
} from './site-map';
import type { ProgrammeBoard, ProgrammeEntry } from './types';

// A map pin: its tip at the bottom of its box, a hole in its head.
const PIN =
  '<path d="M7 18.5C5 14.5 1 11.5 1 7.5a6 6 0 0 1 12 0c0 4-4 7-6 11z" fill="var(--turquoise)" stroke="#06142c" stroke-width="1.1"/>' +
  '<circle cx="7" cy="7.5" r="2.2" fill="#06142c"/>';

// The pin's pace along the paths, in map units a second, and the longest a move lasts.
const PIN_SPEED = 280;
const PIN_LONGEST_MS = 900;

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

function place(node: HTMLElement, point: Point): void {
  const [x, y] = shareOf(point);
  node.style.setProperty('left', `${(x * 100).toFixed(3)}%`);
  node.style.setProperty('top', `${(y * 100).toFixed(3)}%`);
}

function stopOf(entry: ProgrammeEntry, point: Point): HTMLButtonElement {
  const node = el('button', 'ui-programme__stop');
  node.type = 'button';
  node.tabIndex = -1;
  node.setAttribute('role', 'option');
  node.dataset.locked = entry.locked === true ? 'true' : 'false';
  const medallion = createPortrait(entry, 'ui-programme__medallion').element;
  if (entry.locked === true) {
    medallion.append(icon('ui-programme__badge', LOCK));
  }
  node.append(medallion, el('span', 'ui-programme__stop-name', entry.name));
  place(node, point);
  return node;
}

// The Map tab's board: the site map, each stage a medallion on it, and a pin walking the paths to
// the selected one.
export function createStageMap(entries: readonly ProgrammeEntry[]): ProgrammeBoard {
  if (entries.length !== SITE_STOPS.length) {
    throw new Error(
      `The site map places ${String(SITE_STOPS.length)} stages, the Programme has ${String(entries.length)}`,
    );
  }
  const element = el('div', 'ui-programme__map');
  element.setAttribute('role', 'listbox');
  const terrain = el('span', 'ui-programme__terrain');
  terrain.setAttribute('aria-hidden', 'true');
  terrain.innerHTML = `<svg viewBox="${SITE_VIEW_BOX}" focusable="false">${siteTerrain()}</svg>`;
  const stops = entries.map((entry, index) => stopOf(entry, SITE_STOPS[index] ?? [0, 0]));
  const pin = icon('ui-programme__pin', PIN, '0 0 14 19');
  element.append(terrain, ...stops, pin);

  let at = -1;
  let walk: number | null = null;
  // Where the pin is along the paths, its tip lifted onto a medallion near one.
  let spot: Point = [0, 0];

  function stand(point: Point): void {
    spot = point;
    place(pin, pinTip(point));
  }

  function park(index: number): void {
    if (walk !== null) {
      cancelAnimationFrame(walk);
    }
    walk = null;
    pin.dataset.walking = 'false';
    stand(SITE_STOPS[index] ?? [0, 0]);
  }

  function still(): boolean {
    return typeof requestAnimationFrame === 'undefined' || element.closest('.calm') !== null;
  }

  function travel(from: number, to: number): void {
    if (walk !== null) {
      cancelAnimationFrame(walk);
    }
    const way = [spot, ...route(from, to)];
    const lasts = Math.min(PIN_LONGEST_MS, (lengthOf(way) / PIN_SPEED) * 1000);
    const start = performance.now();
    pin.dataset.walking = 'true';
    const step = (now: number) => {
      const share = Math.min(1, (now - start) / lasts);
      stand(pointAlong(way, ease(share)));
      walk = share < 1 ? requestAnimationFrame(step) : null;
      if (walk === null) {
        park(to);
      }
    };
    walk = requestAnimationFrame(step);
  }

  return {
    element,
    stops,
    select(index) {
      if (at === -1 || at === index || still()) {
        park(index);
      } else {
        travel(at, index);
      }
      at = index;
    },
    lay(width, height) {
      const across = Math.min(width, height * SITE_RATIO);
      element.style.setProperty('width', `${String(Math.floor(across))}px`);
      element.style.setProperty('height', `${String(Math.floor(across / SITE_RATIO))}px`);
    },
  };
}

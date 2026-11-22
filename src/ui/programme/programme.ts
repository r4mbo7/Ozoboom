import './programme.css';
import type { InputDevice, MenuIntents } from '../../input/intents';
import { direction, t } from '../../shared/i18n';
import { wrap } from '../../shared/scalar';
import { fitNames } from '../class-cards';
import { keepArticle } from '../class-screen';
import { el, icon, keycap, onPointerClick, setText } from '../dom';
import { LOCK } from '../icons';
import { onMouseMove } from '../pointer';
import type { Prompts } from '../prompts';
import { screenSide, stepInDirection } from '../remap-cursor';
import { createPortrait, type PortraitView } from './portrait';
import { createSheet } from './sheet';
import type { ProgrammeArt, ProgrammeBoard, ProgrammeEntry, ProgrammeTab } from './types';
import { breakableName, gluedName } from './word-break';

export interface ProgrammeScreen {
  readonly element: HTMLElement;
  // On its first tab and first entry.
  open(): void;
  handle(edges: MenuIntents): void;
  setDevice(device: InputDevice): void;
}

// The tab Q / E or LB / RB turn to, around the strip's ends.
export function tabAfter(index: number, count: number, edges: MenuIntents): number {
  const step = (edges.next ? 1 : 0) - (edges.previous ? 1 : 0);
  return wrap(index + step, count);
}

export interface TileRoom {
  readonly width: number;
  readonly height: number;
  readonly rowGap: number;
  // The name printed under each tile, with its margin.
  readonly under: number;
  readonly most: number;
}

export interface TileFit {
  readonly columns: number;
  // A tile's column: the square, and the gap beside it, which its name may take.
  readonly cell: number;
  readonly tile: number;
}

// A name under its tile takes two lines at most.
const NAME_LINES = 2;

// The gap between two tiles, as a share of a tile; when the height bounds the tiles, the gap grows to
// the width left, up to the widest share, so that the names get it.
const TILE_GAP = 0.14;
const WIDEST_GAP = 0.4;

// A tile and its gap, in so many columns: the widest whose rows, each name under its tile, all hold.
function cardIn(count: number, columns: number, room: TileRoom): number {
  const rows = Math.ceil(count / columns);
  return Math.min(
    room.most * (1 + TILE_GAP),
    room.width / columns,
    ((room.height - rows * room.under - (rows - 1) * room.rowGap) / rows) * (1 + TILE_GAP),
  );
}

function tilesIn(count: number, columns: number, room: TileRoom): TileFit {
  const tile = Math.floor(cardIn(count, columns, room) / (1 + TILE_GAP));
  const cell = Math.min(Math.floor(room.width / columns), Math.floor(tile * (1 + WIDEST_GAP)));
  return { columns, cell, tile };
}

// Fewer rows win while their tiles stay this near the widest: three traps stand in one row.
const ROWS_LEEWAY = 0.9;

// The widest square tiles whose rows, each name under its tile, all hold in the room, in as few rows
// as keep them near that wide.
export function fitTiles(count: number, room: TileRoom): TileFit {
  const tries = Array.from({ length: count }, (_, row) => {
    const columns = Math.ceil(count / (row + 1));
    return { columns, card: cardIn(count, columns, room) };
  });
  const widest = Math.max(...tries.map(({ card }) => card));
  const chosen = tries.find(({ card }) => card >= widest * ROWS_LEEWAY) ?? { columns: count };
  return tilesIn(count, chosen.columns, room);
}

// A tile gives up at most this share of its width for its name.
const NAMES_SHARE = 0.25;

// The layouts to try, while a name is too long for its column: the widest tiles, then their columns
// as wide as the room, then fewer columns as wide as the room while their tiles stay near as wide.
export function tileTries(count: number, room: TileRoom): readonly TileFit[] {
  const best = fitTiles(count, room);
  const tries = [best, { ...best, cell: Math.floor(room.width / best.columns) }];
  for (let columns = best.columns - 1; columns >= 1; columns -= 1) {
    const fit = tilesIn(count, columns, room);
    if (fit.tile < best.tile * (1 - NAMES_SHARE)) {
      break;
    }
    tries.push({ ...fit, cell: Math.floor(room.width / columns) });
  }
  return tries;
}

// The Ozoboom sun printed in gold over the horizon, two turquoise ripples under it.
const SUN =
  '<path class="ui-programme__sun-disc" d="M20 30a12 12 0 0 1 24 0z"/>' +
  '<path class="ui-programme__sun-rays" d="' +
  Array.from({ length: 7 }, (_, ray) => {
    const turn = Math.PI * (1 - (ray + 1) / 8);
    const point = (radius: number) =>
      `${(32 + radius * Math.cos(turn)).toFixed(1)} ${(30 - radius * Math.sin(turn)).toFixed(1)}`;
    return `M${point(16)}L${point(21)}`;
  }).join('') +
  '"/><path class="ui-programme__sun-line" d="M6 30.5h52"/>' +
  '<path class="ui-programme__sun-water" d="M16 35h32M23 39.5h18"/>';

const BACK = '<path d="M15 5l-7 7 7 7"/>';

interface Tile {
  readonly node: HTMLButtonElement;
  readonly name: HTMLElement;
  readonly label: string;
  readonly portrait: PortraitView;
}

const overflows = (name: HTMLElement): boolean => name.scrollWidth > name.clientWidth + 1;

// A name keeps its article on its first line while the tile holds it; a longer one breaks after the
// article.
function printEach(tiles: readonly Tile[]): void {
  for (const { name, label } of tiles) {
    setText(name, keepArticle(gluedName(label)));
  }
  for (const { name, label } of tiles.filter(({ name }) => overflows(name))) {
    setText(name, gluedName(label));
  }
}

// One word too long shrinks every name alike; one still too long breaks between two syllables.
function printNames(grid: HTMLElement, tiles: readonly Tile[]): void {
  for (const { name } of tiles) {
    name.style.removeProperty('font-size');
  }
  printEach(tiles);
  fitNames(grid, '.ui-programme__tile-name');
  const size = Math.min(
    ...tiles.map(({ name }) => parseFloat(name.style.fontSize)).filter(Number.isFinite),
  );
  if (Number.isFinite(size)) {
    for (const { name } of tiles) {
      name.style.fontSize = `${String(size)}px`;
    }
    printEach(tiles);
  }
  for (const { name, label } of tiles.filter(({ name }) => overflows(name))) {
    setText(name, breakableName(label));
  }
}

export function createProgramme(
  prompts: Prompts,
  tabs: readonly ProgrammeTab[],
  art: ProgrammeArt,
  leave: () => void,
): ProgrammeScreen {
  const close = () => {
    art.quiet();
    leave();
  };
  const element = el('section', 'ui-screen ui-programme');
  element.setAttribute('aria-label', t('The Programme'));
  const guide = el('div', 'ui-programme__guide');

  const strip = el('nav', 'ui-programme__panel ui-programme__strip');
  const cover = el('header', 'ui-programme__cover');
  cover.append(
    icon('ui-programme__sun', SUN, '0 0 64 42'),
    el('h2', 'ui-programme__cover-title', t('The Programme')),
    el('p', 'ui-programme__brand', 'Ozoboom'),
  );
  const tabList = el('div', 'ui-programme__tabs');
  tabList.setAttribute('role', 'tablist');
  const tabButtons = tabs.map((tab, index) => {
    const node = el('button', 'ui-programme__tab', tab.title());
    node.type = 'button';
    node.tabIndex = -1;
    node.setAttribute('role', 'tab');
    node.dataset.tab = tab.id;
    onPointerClick(node, () => {
      showTab(index);
    });
    return node;
  });
  tabList.append(...tabButtons);
  const keys = el('p', 'ui-programme__keys');
  const back = el('button', 'ui-programme__back');
  back.type = 'button';
  back.tabIndex = -1;
  back.append(icon('ui-programme__chevron', BACK), t('Back'));
  onPointerClick(back, close);
  const foot = el('div', 'ui-programme__foot');
  foot.append(keys, back);
  strip.append(cover, tabList, foot);

  const board = el('div', 'ui-programme__panel ui-programme__board');
  board.setAttribute('role', 'tabpanel');
  const heading = el('h3', 'ui-programme__heading');
  const room = el('div', 'ui-programme__room');
  const grid = el('div', 'ui-programme__grid');
  grid.setAttribute('role', 'listbox');
  room.append(grid);
  board.append(heading, el('span', 'ui-programme__rule'), room);

  const sheet = createSheet();
  guide.append(strip, board, sheet.element);
  element.append(guide);

  const made = new Map<string, readonly ProgrammeEntry[]>();
  const boards = new Map<string, ProgrammeBoard>();
  const picked = new Map<string, number>();
  let tabIndex = 0;
  let tiles: Tile[] = [];
  let tabBoard: ProgrammeBoard | null = null;
  // What the arrows walk and the selection marks: the tiles, or the board's stops.
  let stops: readonly HTMLElement[] = [];
  let selected = 0;
  let device: InputDevice = 'none';

  function entriesOf(tab: ProgrammeTab): readonly ProgrammeEntry[] {
    const known = made.get(tab.id);
    if (known !== undefined) {
      return known;
    }
    const entries = tab.entries(art);
    made.set(tab.id, entries);
    return entries;
  }

  function currentTab(): ProgrammeTab {
    const tab = tabs[tabIndex];
    if (tab === undefined) {
      throw new Error('The Programme has no tab');
    }
    return tab;
  }

  function showSheet(): void {
    const entry = entriesOf(currentTab())[selected];
    if (entry === undefined) {
      return;
    }
    const shown = prompts.for(device);
    sheet.show(entry, device === 'touch' ? null : shown.confirm, shown.style);
    fitNames(sheet.element, '.ui-programme__title');
    sheet.paint();
  }

  function select(index: number): void {
    if (index !== selected) {
      art.quiet();
    }
    selected = index;
    picked.set(currentTab().id, index);
    tabBoard?.select(index);
    stops.forEach((node, position) => {
      node.toggleAttribute('aria-current', position === index);
      node.setAttribute('aria-selected', position === index ? 'true' : 'false');
    });
    showSheet();
  }

  function tileOf(entry: ProgrammeEntry, index: number): Tile {
    const node = el('button', 'ui-programme__tile');
    node.type = 'button';
    node.tabIndex = -1;
    node.setAttribute('role', 'option');
    node.dataset.locked = entry.locked === true ? 'true' : 'false';
    const portrait = createPortrait(entry, 'ui-programme__square');
    if (entry.locked === true) {
      portrait.element.append(icon('ui-programme__badge', LOCK));
    }
    // Its name stays its label when the board leaves names to the sheet.
    node.setAttribute('aria-label', entry.name);
    const name = el('span', 'ui-programme__tile-name', entry.name);
    node.append(portrait.element, name);
    pickedBy(node, index);
    return { node, name, label: entry.name, portrait };
  }

  // The mouse selects what it moves over, a click or a tap what it hits.
  function pickedBy(node: HTMLElement, index: number): void {
    onMouseMove(node, () => {
      if (selected !== index) {
        select(index);
      }
    });
    onPointerClick(node, () => {
      select(index);
    });
  }

  function boardOf(tab: ProgrammeTab): ProgrammeBoard | null {
    if (tab.board === undefined) {
      return null;
    }
    const known = boards.get(tab.id);
    if (known !== undefined) {
      return known;
    }
    const built = tab.board(entriesOf(tab));
    built.stops.forEach((node, index) => {
      pickedBy(node, index);
    });
    boards.set(tab.id, built);
    return built;
  }

  // Lays the tiles as `fit` says: true when every name holds in its column.
  function place(fit: TileFit): boolean {
    grid.style.setProperty('--columns', String(fit.columns));
    grid.style.setProperty('--cell', `${String(fit.cell)}px`);
    grid.style.setProperty('--tile', `${String(fit.tile)}px`);
    printNames(grid, tiles);
    return !tiles.some(({ name }) => overflows(name));
  }

  function lay(): void {
    const box = room.getBoundingClientRect();
    if (tabBoard !== null) {
      if (box.width > 0) {
        tabBoard.lay(Math.floor(box.width), Math.floor(box.height));
      }
      sheet.paint();
      fitNames(sheet.element, '.ui-programme__title');
      return;
    }
    const name = tiles[0]?.name;
    if (box.width === 0 || name === undefined) {
      return;
    }
    name.style.removeProperty('font-size');
    delete grid.dataset.unnamed;
    const style = getComputedStyle(grid);
    const nameStyle = getComputedStyle(name);
    const area = {
      width: Math.floor(box.width),
      height: Math.floor(box.height),
      rowGap: parseFloat(style.rowGap),
      under: NAME_LINES * parseFloat(nameStyle.lineHeight) + parseFloat(nameStyle.marginTop),
      most: parseFloat(style.getPropertyValue('--tile-most')),
    };
    const tries = tileTries(tiles.length, area);
    let fit = tries.find((tried) => place(tried));
    if (fit === undefined) {
      // No layout holds every name, a long list on a phone: the names are left to the sheet.
      grid.dataset.unnamed = 'true';
      fit = fitTiles(tiles.length, { ...area, under: 0 });
      place(fit);
    }
    // A name that takes a line more than planned takes it from the tiles, their columns kept.
    const over = grid.getBoundingClientRect().height - box.height;
    if (over > 0) {
      const rows = Math.ceil(tiles.length / fit.columns);
      grid.style.setProperty('--tile', `${String(fit.tile - Math.ceil(over / rows))}px`);
    }
    for (const tile of tiles) {
      tile.portrait.paint();
    }
    fitNames(sheet.element, '.ui-programme__title');
    sheet.paint();
  }

  function showTab(index: number): void {
    tabIndex = index;
    const tab = currentTab();
    tabButtons.forEach((node, position) => {
      node.setAttribute('aria-selected', position === index ? 'true' : 'false');
    });
    setText(heading, tab.title());
    grid.setAttribute('aria-label', tab.title());
    board.dataset.tab = tab.id;
    art.quiet();
    tabBoard = boardOf(tab);
    if (tabBoard === null) {
      tiles = entriesOf(tab).map(tileOf);
      grid.replaceChildren(...tiles.map(({ node }) => node));
      stops = tiles.map(({ node }) => node);
      room.replaceChildren(grid);
    } else {
      tiles = [];
      stops = tabBoard.stops;
      room.replaceChildren(tabBoard.element);
    }
    select(picked.get(tab.id) ?? 0);
    lay();
  }

  function showKeys(): void {
    const shown = prompts.for(device);
    keys.replaceChildren(
      ...shown.tabs.map((key) => keycap(key, shown.style)),
      ...(shown.tabs.length === 0 ? [] : [el('span', 'ui-programme__keys-label', t('tabs'))]),
    );
    keys.hidden = shown.tabs.length === 0;
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(lay).observe(room);
  }
  // Tiles laid in a fallback face hold names its own face widens once it loads: they are laid again.
  if ('fonts' in document) {
    document.fonts.addEventListener('loadingdone', lay);
  }

  return {
    element,
    open() {
      picked.clear();
      boards.clear();
      showKeys();
      showTab(0);
    },
    handle(edges) {
      if (edges.back) {
        close();
        return;
      }
      if (edges.previous !== edges.next) {
        showTab(tabAfter(tabIndex, tabs.length, edges));
        return;
      }
      const side = screenSide(edges, direction());
      if (side !== null) {
        const next = stepInDirection(
          stops.map((node) => node.getBoundingClientRect()),
          selected,
          side,
        );
        if (next !== selected) {
          select(next);
        }
      }
      if (edges.confirm) {
        entriesOf(currentTab())[selected]?.listen?.();
      }
    },
    setDevice(next) {
      device = next;
      showKeys();
      if (stops.length > 0) {
        showSheet();
      }
    },
  };
}

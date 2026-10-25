import type { MenuDirection } from '../input/bindings';
import type { MenuIntents } from '../input/intents';
import type { Direction } from '../shared/i18n';
import { clamp } from '../shared/scalar';
import { onPointerClick } from './dom';
import { onMouseMove } from './pointer';
import type { Tab } from './remap-model';

export interface Cell {
  readonly node: HTMLButtonElement;
  // null for the buttons of both tabs.
  readonly tab: Tab | null;
  readonly activate: () => void;
}

export interface CellCursor {
  select(index: number): void;
  handle(edges: MenuIntents, reading: Direction): void;
}

export function createCellCursor(
  cells: readonly Cell[],
  shownTab: () => Tab,
  listening: () => boolean,
): CellCursor {
  let index = 0;

  function visibleCells(): Cell[] {
    return cells.filter((cell) => cell.tab === null || cell.tab === shownTab());
  }

  function select(next: number): void {
    const visible = visibleCells();
    index = clamp(next, 0, visible.length - 1);
    for (const cell of cells) {
      cell.node.removeAttribute('aria-current');
    }
    visible[index]?.node.setAttribute('aria-current', 'true');
  }

  for (const cell of cells) {
    onMouseMove(cell.node, () => {
      const position = visibleCells().indexOf(cell);
      if (!listening() && position >= 0 && position !== index) {
        select(position);
      }
    });
    onPointerClick(cell.node, () => {
      const position = visibleCells().indexOf(cell);
      if (listening() || position < 0) {
        return;
      }
      select(position);
      cell.activate();
    });
  }

  return {
    select,
    handle(edges, reading) {
      const side = screenSide(edges, reading);
      const visible = visibleCells();
      if (side !== null) {
        const next = stepInDirection(
          visible.map((cell) => cell.node.getBoundingClientRect()),
          index,
          side,
        );
        if (next !== index) {
          select(next);
          visible[next]?.node.scrollIntoView({ block: 'nearest' });
        }
      }
      if (edges.confirm) {
        visible[index]?.activate();
      }
    },
  };
}

// The menus read left and right along the reading direction: the boxes are laid out on screen.
export function screenSide(
  edges: Pick<MenuIntents, 'up' | 'down' | 'left' | 'right'>,
  reading: Direction,
): MenuDirection | null {
  const rtl = reading === 'rtl';
  return edges.up
    ? 'up'
    : edges.down
      ? 'down'
      : (rtl ? edges.right : edges.left)
        ? 'left'
        : (rtl ? edges.left : edges.right)
          ? 'right'
          : null;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// Most in line first: rows and columns stay walkable however the screen lays them out.
export function stepInDirection(boxes: readonly Box[], from: number, side: MenuDirection): number {
  const origin = boxes[from];
  if (origin === undefined) {
    return from;
  }
  const ox = origin.x + origin.width / 2;
  const oy = origin.y + origin.height / 2;
  let best = from;
  let bestScore = Infinity;
  boxes.forEach((box, index) => {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const vertical = side === 'up' || side === 'down';
    const along = { up: oy - cy, down: cy - oy, left: ox - cx, right: cx - ox }[side];
    const across = vertical ? Math.abs(cx - ox) : Math.abs(cy - oy);
    if (index === from || along < 1) {
      return;
    }
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

import type { MenuIntents } from '../input/intents';
import { direction } from '../shared/i18n';
import { clamp } from '../shared/scalar';
import { onPointerClick } from './dom';
import { navigateMenu } from './navigation';
import { onMouseMove } from './pointer';
import { type Box, screenSide, stepInDirection } from './remap-cursor';

// In a menu laid out in columns, left and right go to the item beside on screen. In a list, or
// with nothing beside, they step through its order (`null`), wrapping around a row's ends.
// Hidden items have no box and are never stepped to.
export function stepAcross(
  boxes: readonly Box[],
  from: number,
  side: 'left' | 'right',
): number | null {
  const shown = boxes.filter((box) => box.width > 0 && box.height > 0);
  if (new Set(shown.map((box) => Math.round(box.x))).size < 2) {
    return null;
  }
  const beside = stepInDirection(boxes, from, side);
  return beside === from ? null : beside;
}

export interface Menu {
  readonly index: number;
  // `selected` stays the current item; the first one is by default.
  setItems(items: readonly HTMLElement[], selected?: number): void;
  select(index: number): void;
  handle(edges: MenuIntents): void;
}

// `onAdjust` answers whether it took a left or right press; one it did not take moves through the menu.
export function createMenu(
  onActivate: (index: number) => void,
  onAdjust?: (index: number, side: -1 | 1) => boolean,
): Menu {
  let items: readonly HTMLElement[] = [];
  let index = 0;
  // Items come and go between calls to `setItems`: each is wired once.
  const bound = new WeakSet<HTMLElement>();

  function select(next: number): void {
    index = clamp(next, 0, Math.max(items.length - 1, 0));
    // Only what changes is written: a menu settled again on the same item moves nothing.
    items.forEach((item, position) => {
      if (position !== index) {
        item.removeAttribute('aria-current');
      } else if (item.getAttribute('aria-current') !== 'true') {
        item.setAttribute('aria-current', 'true');
      }
    });
  }

  return {
    get index() {
      return index;
    },
    setItems(next, selected = 0) {
      items = next;
      for (const item of items) {
        item.tabIndex = -1;
        if (bound.has(item)) {
          continue;
        }
        bound.add(item);
        onMouseMove(item, () => {
          const position = items.indexOf(item);
          if (position >= 0 && index !== position) {
            select(position);
          }
        });
        onPointerClick(item, () => {
          const position = items.indexOf(item);
          if (position < 0) {
            return;
          }
          select(position);
          onActivate(position);
        });
      }
      select(selected);
    },
    select,
    handle(edges) {
      if (edges.left !== edges.right && onAdjust?.(index, edges.right ? 1 : -1) === true) {
        return;
      }
      const step = navigateMenu(index, items.length, edges);
      const side =
        edges.left === edges.right
          ? null
          : screenSide({ ...edges, up: false, down: false }, direction());
      const across =
        side === 'left' || side === 'right'
          ? stepAcross(
              items.map((item) => item.getBoundingClientRect()),
              index,
              side,
            )
          : null;
      const next = across ?? step.index;
      if (next !== index) {
        select(next);
        // A long menu scrolls: the keyboard and the gamepad follow their selection.
        items[index]?.scrollIntoView({ block: 'nearest' });
      }
      if (step.confirmed && items.length > 0) {
        onActivate(index);
      }
    },
  };
}

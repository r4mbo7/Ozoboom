import type { MenuIntents } from '../input/intents';
import { navigateMenu } from './navigation';
import { onMouseMove } from './pointer';

export interface Menu {
  readonly index: number;
  setItems(items: readonly HTMLElement[]): void;
  select(index: number): void;
  handle(edges: MenuIntents): void;
}

// `onAdjust` takes the left and right presses of an item that is picked from side to side: it
// answers whether it did, and a press it did not take moves through the menu as before.
export function createMenu(
  onActivate: (index: number) => void,
  onAdjust?: (index: number, side: -1 | 1) => boolean,
): Menu {
  let items: readonly HTMLElement[] = [];
  let index = 0;
  // Items come and go between calls to `setItems`: each is wired once.
  const bound = new WeakSet<HTMLButtonElement>();

  function select(next: number): void {
    index = Math.min(Math.max(next, 0), Math.max(items.length - 1, 0));
    items.forEach((item, position) => {
      if (position === index) {
        item.setAttribute('aria-current', 'true');
      } else {
        item.removeAttribute('aria-current');
      }
    });
  }

  return {
    get index() {
      return index;
    },
    setItems(next) {
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
        item.addEventListener('click', (event) => {
          const position = items.indexOf(item);
          if (event.detail === 0 || position < 0) {
            return;
          }
          select(position);
          onActivate(position);
        });
      }
      select(0);
    },
    select,
    handle(edges) {
      if (edges.left !== edges.right && onAdjust?.(index, edges.right ? 1 : -1) === true) {
        return;
      }
      const step = navigateMenu(index, items.length, edges);
      if (step.index !== index) {
        select(step.index);
      }
      if (step.confirmed && items.length > 0) {
        onActivate(index);
      }
    },
  };
}

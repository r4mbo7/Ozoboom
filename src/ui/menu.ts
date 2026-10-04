import type { MenuIntents } from '../input/intents';
import { navigateMenu } from './navigation';
import { onMouseMove } from './pointer';

export interface Menu {
  readonly index: number;
  setItems(items: readonly HTMLButtonElement[]): void;
  select(index: number): void;
  handle(edges: MenuIntents): void;
}

export function createMenu(onActivate: (index: number) => void): Menu {
  let items: readonly HTMLButtonElement[] = [];
  let index = 0;

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
      items.forEach((item, position) => {
        item.tabIndex = -1;
        onMouseMove(item, () => {
          if (index !== position) {
            select(position);
          }
        });
        item.addEventListener('click', (event) => {
          if (event.detail === 0) {
            return;
          }
          select(position);
          onActivate(position);
        });
      });
      select(0);
    },
    select,
    handle(edges) {
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

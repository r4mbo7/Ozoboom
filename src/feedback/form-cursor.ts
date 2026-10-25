import { onPointerClick } from '../ui/dom';
import { onMouseMove } from '../ui/pointer';
import type { Page } from './form-view';
import type { FormItem } from './navigation';

export interface FormCursor {
  readonly page: Page;
  readonly index: number;
  select(target: Page, next: number, reveal?: boolean): void;
  show(next: Page): void;
}

export interface PointerGuards {
  busy(): boolean;
  typing(): boolean;
  activate(item: FormItem): void;
}

export function createFormCursor(
  pages: readonly [Page, ...Page[]],
  guards: PointerGuards,
): FormCursor {
  let page = pages[0];
  let index = 0;

  function select(target: Page, next: number, reveal = false): void {
    index = next;
    target.items.forEach((item, position) => {
      const node = target.nodes.get(item);
      if (position === next) {
        node?.setAttribute('aria-current', 'true');
        if (reveal) {
          node?.scrollIntoView({ block: 'nearest' });
        }
      } else {
        node?.removeAttribute('aria-current');
      }
    });
  }

  for (const target of pages) {
    target.items.forEach((item, position) => {
      const node = target.nodes.get(item);
      if (node === undefined) {
        return;
      }
      onMouseMove(node, () => {
        if (index !== position && !guards.typing()) {
          select(target, position);
        }
      });
      if (node instanceof HTMLButtonElement) {
        onPointerClick(node, () => {
          if (guards.busy()) {
            return;
          }
          select(target, position);
          guards.activate(item);
        });
      }
    });
  }

  return {
    get page() {
      return page;
    },
    get index() {
      return index;
    },
    select,
    show(next) {
      select(page, -1);
      page.element.hidden = true;
      page = next;
      page.element.hidden = false;
      select(page, 0);
    },
  };
}

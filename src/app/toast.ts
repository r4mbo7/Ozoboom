import { el } from '../ui/dom';

const TOAST_MS = 6000;

export interface Toast {
  show(text: string): void;
  clear(): void;
}

// A line over the game that fades by itself: who left, while the set goes on.
export function createToast(root: HTMLElement): Toast {
  const layer = el('div', 'ui toast');
  layer.setAttribute('role', 'status');
  root.append(layer);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clear(): void {
    clearTimeout(timer);
    layer.replaceChildren();
  }

  return {
    show(text) {
      clearTimeout(timer);
      layer.replaceChildren(el('p', 'toast__line', text));
      timer = setTimeout(clear, TOAST_MS);
    },
    clear,
  };
}

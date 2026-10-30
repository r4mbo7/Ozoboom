import type { MenuIntents } from '../input/intents';

// The cards, or the shown button at that index under them.
export type RowFocus = 'cards' | number;

export interface RowStep {
  focus: RowFocus;
  // The button a validation pressed.
  pressed: number | null;
  // The presses were for the buttons: the cards do nothing with them.
  taken: boolean;
}

// Down from the cards reaches the first button and up goes back; along the buttons, the sides move and a validation presses. Going back stays the screen's.
export function stepButtonRow(focus: RowFocus, count: number, edges: MenuIntents): RowStep {
  if (edges.back || count === 0) {
    return { focus: 'cards', pressed: null, taken: false };
  }
  if (focus === 'cards') {
    return edges.down
      ? { focus: 0, pressed: null, taken: true }
      : { focus, pressed: null, taken: false };
  }
  const at = Math.min(focus, count - 1);
  if (edges.up) {
    return { focus: 'cards', pressed: null, taken: true };
  }
  if (edges.confirm) {
    return { focus: at, pressed: at, taken: true };
  }
  const side = (edges.right ? 1 : 0) - (edges.left ? 1 : 0);
  return { focus: Math.max(0, Math.min(at + side, count - 1)), pressed: null, taken: true };
}

export interface ButtonRow {
  // Null on the cards.
  readonly focused: HTMLButtonElement | null;
  // Back on the cards, as when the screen opens.
  reset(): void;
  // True when the presses were for the buttons.
  handle(edges: MenuIntents): boolean;
}

export function createButtonRow(
  cards: HTMLElement,
  buttons: readonly HTMLButtonElement[],
): ButtonRow {
  let focus: RowFocus = 'cards';

  function shown(): HTMLButtonElement[] {
    return buttons.filter((button) => !button.hidden);
  }

  function paint(): void {
    const lit = focus === 'cards' ? cards : shown()[focus];
    for (const node of [cards, ...buttons]) {
      if (node === lit) {
        node.setAttribute('aria-current', 'true');
      } else {
        node.removeAttribute('aria-current');
      }
    }
  }

  paint();

  return {
    get focused() {
      return focus === 'cards' ? null : (shown()[focus] ?? null);
    },
    reset() {
      focus = 'cards';
      paint();
    },
    handle(edges) {
      const row = shown();
      const step = stepButtonRow(focus, row.length, edges);
      if (step.focus !== focus) {
        focus = step.focus;
        paint();
        if (focus !== 'cards') {
          row[focus]?.scrollIntoView({ block: 'nearest' });
        }
      }
      if (step.pressed !== null) {
        row[step.pressed]?.click();
      }
      return step.taken;
    },
  };
}

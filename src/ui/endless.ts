import type { MenuIntents } from '../input/intents';
import { t } from '../shared/i18n';
import { type Toggle, createToggle } from './toggle';

export function createEndlessToggle(): Toggle {
  const toggle = createToggle(
    t('Sans fin'),
    t('Après le dernier boss, la nuit continue'),
    t('Oui'),
    t('Non'),
  );
  toggle.button.classList.add('ui-toggle--endless');
  toggle.button.tabIndex = -1;
  return toggle;
}

export type PickerRow = 'cards' | 'endless';

export interface EndlessStep {
  row: PickerRow;
  toggled: boolean;
  // Left steps a choice back, anything else forward.
  direction: -1 | 1;
  // The presses were for the switch: the cards do nothing with them.
  taken: boolean;
}

// A picker that launches has the endless switch under its cards: up and down move between the two,
// and on the switch a side or a validation flips it. Going back stays the picker's.
export function stepEndless(row: PickerRow, shown: boolean, edges: MenuIntents): EndlessStep {
  const direction = edges.left ? -1 : 1;
  if (!shown) {
    return { row: 'cards', toggled: false, direction, taken: false };
  }
  if (edges.back) {
    return { row, toggled: false, direction, taken: false };
  }
  if (edges.up || edges.down) {
    return { row: row === 'cards' ? 'endless' : 'cards', toggled: false, direction, taken: true };
  }
  const toggled = row === 'endless' && (edges.confirm || edges.left || edges.right);
  return { row, toggled, direction, taken: toggled };
}

export interface SwitchRow {
  readonly row: PickerRow;
  // Back on the cards, as when the picker opens.
  reset(): void;
  show(shown: boolean): void;
  // True when the presses were for the switch.
  handle(edges: MenuIntents): boolean;
}

// The switch under the cards of a picker, and which of the two the presses go to.
export function createSwitchRow(
  cards: HTMLElement,
  button: HTMLButtonElement,
  press: (direction: -1 | 1) => void,
): SwitchRow {
  let row: PickerRow = 'cards';
  let shown = false;

  function paint(): void {
    for (const [node, lit] of [
      [cards, row === 'cards'],
      [button, row === 'endless'],
    ] as const) {
      if (lit) {
        node.setAttribute('aria-current', 'true');
      } else {
        node.removeAttribute('aria-current');
      }
    }
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    press(1);
  });
  paint();

  return {
    get row() {
      return row;
    },
    reset() {
      row = 'cards';
      paint();
    },
    show(next) {
      shown = next;
      button.hidden = !shown;
      if (!shown && row !== 'cards') {
        row = 'cards';
      }
      paint();
    },
    handle(edges) {
      const step = stepEndless(row, shown, edges);
      if (step.row !== row) {
        row = step.row;
        paint();
      }
      if (step.toggled) {
        press(step.direction);
      }
      return step.taken;
    },
  };
}

export interface EndlessRow {
  readonly toggle: Toggle;
  readonly row: PickerRow;
  reset(): void;
  set(on: boolean, shown: boolean): void;
  handle(edges: MenuIntents): boolean;
}

export function createEndlessRow(cards: HTMLElement, onToggle: (on: boolean) => void): EndlessRow {
  const toggle = createEndlessToggle();
  let on = false;
  const row = createSwitchRow(cards, toggle.button, () => {
    onToggle(!on);
  });
  return {
    toggle,
    get row() {
      return row.row;
    },
    reset() {
      row.reset();
    },
    set(nextOn, shown) {
      on = nextOn;
      toggle.set(on);
      row.show(shown);
    },
    handle(edges) {
      return row.handle(edges);
    },
  };
}

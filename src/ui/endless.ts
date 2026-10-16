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
  // The presses were for the switch: the cards do nothing with them.
  taken: boolean;
}

// A picker that launches has the endless switch under its cards: up and down move between the two,
// and on the switch a side or a validation flips it. Going back stays the picker's.
export function stepEndless(row: PickerRow, shown: boolean, edges: MenuIntents): EndlessStep {
  if (!shown) {
    return { row: 'cards', toggled: false, taken: false };
  }
  if (edges.back) {
    return { row, toggled: false, taken: false };
  }
  if (edges.up || edges.down) {
    return { row: row === 'cards' ? 'endless' : 'cards', toggled: false, taken: true };
  }
  const toggled = row === 'endless' && (edges.confirm || edges.left || edges.right);
  return { row, toggled, taken: toggled };
}

export interface EndlessRow {
  readonly toggle: Toggle;
  readonly row: PickerRow;
  // Back on the cards, as when the picker opens.
  reset(): void;
  set(on: boolean, shown: boolean): void;
  // True when the presses were for the switch.
  handle(edges: MenuIntents): boolean;
}

export function createEndlessRow(cards: HTMLElement, onToggle: (on: boolean) => void): EndlessRow {
  const toggle = createEndlessToggle();
  let row: PickerRow = 'cards';
  let on = false;
  let shown = false;

  function paint(): void {
    for (const [node, lit] of [
      [cards, row === 'cards'],
      [toggle.button, row === 'endless'],
    ] as const) {
      if (lit) {
        node.setAttribute('aria-current', 'true');
      } else {
        node.removeAttribute('aria-current');
      }
    }
  }

  toggle.button.addEventListener('click', (event) => {
    event.stopPropagation();
    onToggle(!on);
  });
  paint();

  return {
    toggle,
    get row() {
      return row;
    },
    reset() {
      row = 'cards';
      paint();
    },
    set(nextOn, nextShown) {
      on = nextOn;
      shown = nextShown;
      toggle.set(on);
      toggle.button.hidden = !shown;
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
        onToggle(!on);
      }
      return step.taken;
    },
  };
}

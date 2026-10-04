import type { InputDevice, MenuIntents } from '../input/intents';
import { menuEdges, navigateMenu } from '../ui/navigation';

export interface PauseItem {
  readonly label: string;
  activate(): void;
}

export interface PauseScreen {
  show(device: InputDevice): void;
  hide(): void;
  // Moves the selection and activates the selected item; `back` is the caller's to handle.
  handle(menu: MenuIntents): void;
}

function hint(style: 'key' | 'button', parts: readonly (readonly [string, string])[]): string {
  return parts
    .map(
      ([keys, label]) =>
        `<span class="ui-hint__part">${keys
          .split(' ')
          .map((key) => `<kbd class="ui-key ui-key--${style}">${key}</kbd>`)
          .join('')}<span>${label}</span></span>`,
    )
    .join('');
}

// The pause screen is the app's, but it wears the interface's styles so that it reads as one of
// its screens: it sits in its own `.ui` layer, above the interface. Its items are a list, the first
// one selected when it opens: adding an entry is adding an item.
export function createPauseScreen(root: HTMLElement, items: readonly PauseItem[]): PauseScreen {
  const layer = document.createElement('div');
  layer.className = 'ui';
  layer.innerHTML = `
    <section class="ui-screen ui-overlay" role="dialog" aria-label="Pause" hidden>
      <div class="pause">
        <p class="ui-kicker">Pause</p>
        <h2 class="ui-heading">La piste t’attend</h2>
        <p class="pause__text">Le set reprend là où tu l’as laissé.</p>
        <nav class="pause__menu" aria-label="Menu de pause"></nav>
        <p class="ui-hint"></p>
      </div>
    </section>
  `;
  const screen = layer.querySelector('section');
  const nav = layer.querySelector('nav');
  const hints = layer.querySelector<HTMLElement>('.ui-hint');
  if (screen === null || nav === null || hints === null) {
    throw new Error('Pause screen markup is incomplete');
  }

  let selected = 0;
  let previousMenu: MenuIntents | null = null;
  const buttons = items.map((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.className = index === 0 ? 'ui-button ui-button--primary' : 'ui-button';
    button.textContent = item.label;
    button.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') {
        select(index);
      }
    });
    button.addEventListener('click', (event) => {
      // Enter on a focused button synthesizes a click: the key itself is already an intent.
      if (event.detail !== 0) {
        select(index);
        item.activate();
      }
    });
    return button;
  });
  nav.append(...buttons);
  root.append(layer);

  function select(index: number): void {
    selected = index;
    buttons.forEach((button, position) => {
      if (position === index) {
        button.setAttribute('aria-current', 'true');
      } else {
        button.removeAttribute('aria-current');
      }
    });
  }

  return {
    show(device) {
      const gamepad = device === 'gamepad';
      const navigate = items.length > 1 ? [[gamepad ? 'Croix' : '↑ ↓', 'naviguer'] as const] : [];
      hints.innerHTML = hint(gamepad ? 'button' : 'key', [
        ...navigate,
        [gamepad ? 'A' : 'Entrée', 'valider'],
        [gamepad ? 'Start' : 'Échap', 'reprendre'],
      ]);
      select(0);
      previousMenu = null;
      screen.hidden = false;
    },
    hide() {
      screen.hidden = true;
    },
    handle(menu) {
      const edges = menuEdges(menu, previousMenu);
      previousMenu = menu;
      const step = navigateMenu(selected, items.length, edges);
      if (step.index !== selected) {
        select(step.index);
      }
      if (step.confirmed) {
        items[selected]?.activate();
      }
    },
  };
}

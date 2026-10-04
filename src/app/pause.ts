import type { InputDevice, MenuIntents } from '../input/intents';
import { fillHint } from '../ui/dom';
import { createMenu } from '../ui/menu';
import { menuEdges } from '../ui/navigation';
import { promptsFor } from '../ui/prompts';

export interface PauseItem {
  readonly label: string;
  // A button built elsewhere, for an entry that must look the same on every screen.
  readonly button?: HTMLButtonElement;
  activate(): void;
}

export interface PauseScreen {
  show(device: InputDevice): void;
  hide(): void;
  // Moves the selection and activates the selected item; `back` is the caller's to handle.
  handle(menu: MenuIntents): void;
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

  let previousMenu: MenuIntents | null = null;
  const buttons = items.map((item, index) => {
    const button = item.button ?? document.createElement('button');
    button.type = 'button';
    if (item.button === undefined) {
      button.className = index === 0 ? 'ui-button ui-button--primary' : 'ui-button';
      button.textContent = item.label;
    }
    return button;
  });
  nav.append(...buttons);
  root.append(layer);
  const menu = createMenu((index) => {
    items[index]?.activate();
  });
  menu.setItems(buttons);

  return {
    show(device) {
      const prompts = promptsFor(device);
      const navigate = items.length > 1 ? [{ keys: prompts.navigate, label: 'naviguer' }] : [];
      fillHint(
        hints,
        [
          ...navigate,
          { keys: [prompts.confirm], label: 'valider' },
          { keys: [device === 'gamepad' ? 'Start' : 'Échap'], label: 'reprendre' },
        ],
        prompts.style,
      );
      menu.select(0);
      previousMenu = null;
      screen.hidden = false;
    },
    hide() {
      screen.hidden = true;
    },
    handle(intents) {
      menu.handle(menuEdges(intents, previousMenu));
      previousMenu = intents;
    },
  };
}

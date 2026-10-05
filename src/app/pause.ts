import type { InputDevice, MenuIntents } from '../input/intents';
import type { Vec2 } from '../sim/state';
import { el, fillHint, setText } from '../ui/dom';
import { createMenu } from '../ui/menu';
import { createMenuInput } from '../ui/navigation';
import { promptsFor } from '../ui/prompts';

export interface PauseConfirmation {
  readonly question: string;
  readonly text: string;
  readonly stay: string;
  readonly leave: string;
}

export interface PauseText {
  readonly heading: string;
  readonly text: string;
}

const PAUSE_TEXT: PauseText = {
  heading: 'La piste t’attend',
  text: 'Le set reprend là où tu l’as laissé.',
};

export interface PauseItem {
  readonly label: string;
  // A button built elsewhere, for an entry that must look the same on every screen.
  readonly button?: HTMLButtonElement;
  // Asked before `activate`, which only « leave » runs: « stay » goes back to the pause menu.
  readonly confirm?: PauseConfirmation;
  activate(): void;
}

export interface PauseScreen {
  readonly confirming: boolean;
  // `text` replaces the line under the heading, for a pause that does not stop the set.
  show(device: InputDevice, text?: PauseText): void;
  hide(): void;
  // Leaves the confirmation for the pause menu, on the entry that asked it.
  cancel(): void;
  // Moves the selection and activates the selected item; `back` is the caller's to handle.
  handle(menu: MenuIntents, move: Vec2): void;
}

interface View {
  section: HTMLElement;
  heading: HTMLElement;
  text: HTMLElement;
  nav: HTMLElement;
  hint: HTMLElement;
}

function view(role: 'dialog' | 'alertdialog', heading: string, text: string): View {
  const section = el('section', 'ui-screen ui-overlay');
  section.setAttribute('role', role);
  section.hidden = true;
  const body = el('div', 'pause');
  const parts: View = {
    section,
    heading: el('h2', 'ui-heading', heading),
    text: el('p', 'pause__text', text),
    nav: el('nav', 'pause__menu'),
    hint: el('p', 'ui-hint'),
  };
  body.append(el('p', 'ui-kicker', 'Pause'), parts.heading, parts.text, parts.nav, parts.hint);
  section.append(body);
  return parts;
}

function button(className: string, label: string): HTMLButtonElement {
  const node = el('button', className, label);
  node.type = 'button';
  return node;
}

// The pause screen is the app's, but it wears the interface's styles so that it reads as one of
// its screens: it sits in its own `.ui` layer, above the interface. Its items are a list, the first
// one selected when it opens: adding an entry is adding an item.
export function createPauseScreen(root: HTMLElement, items: readonly PauseItem[]): PauseScreen {
  const layer = el('div', 'ui');
  const main = view('dialog', PAUSE_TEXT.heading, PAUSE_TEXT.text);
  main.section.setAttribute('aria-label', 'Pause');
  main.nav.setAttribute('aria-label', 'Menu de pause');
  const confirmation = view('alertdialog', '', '');
  layer.append(main.section, confirmation.section);

  const menuInput = createMenuInput();
  let device: InputDevice = 'none';
  let pending: PauseItem | null = null;

  const buttons = items.map((item, index) => {
    const node =
      item.button ?? button(index === 0 ? 'ui-button ui-button--primary' : 'ui-button', item.label);
    node.type = 'button';
    return node;
  });
  main.nav.append(...buttons);
  const menu = createMenu((index) => {
    const item = items[index];
    if (item?.confirm === undefined) {
      item?.activate();
    } else {
      ask(item, item.confirm);
    }
  });
  menu.setItems(buttons);

  const stay = button('ui-button ui-button--primary', '');
  const leave = button('ui-button', '');
  confirmation.nav.append(stay, leave);
  const confirmMenu = createMenu((index) => {
    if (index === 0) {
      cancel();
    } else {
      pending?.activate();
    }
  });
  confirmMenu.setItems([stay, leave]);
  root.append(layer);

  function ask(item: PauseItem, asked: PauseConfirmation): void {
    pending = item;
    confirmation.section.setAttribute('aria-label', asked.question);
    confirmation.nav.setAttribute('aria-label', asked.question);
    setText(confirmation.heading, asked.question);
    setText(confirmation.text, asked.text);
    setText(stay, asked.stay);
    setText(leave, asked.leave);
    const prompts = promptsFor(device);
    fillHint(
      confirmation.hint,
      [
        { keys: prompts.navigate, label: 'naviguer' },
        { keys: [prompts.confirm], label: 'valider' },
        { keys: [prompts.back], label: asked.stay.toLowerCase() },
      ],
      prompts.style,
    );
    confirmMenu.select(0);
    menuInput.open();
    main.section.hidden = true;
    confirmation.section.hidden = false;
  }

  function cancel(): void {
    if (pending === null) {
      return;
    }
    menu.select(items.indexOf(pending));
    pending = null;
    confirmation.section.hidden = true;
    main.section.hidden = false;
  }

  return {
    get confirming() {
      return pending !== null;
    },
    show(next, text = PAUSE_TEXT) {
      device = next;
      setText(main.heading, text.heading);
      setText(main.text, text.text);
      const prompts = promptsFor(device);
      const navigate = items.length > 1 ? [{ keys: prompts.navigate, label: 'naviguer' }] : [];
      fillHint(
        main.hint,
        [
          ...navigate,
          { keys: [prompts.confirm], label: 'valider' },
          { keys: [device === 'gamepad' ? 'Start' : 'Échap'], label: 'reprendre' },
        ],
        prompts.style,
      );
      menu.select(0);
      menuInput.open();
      main.section.hidden = false;
    },
    hide() {
      pending = null;
      main.section.hidden = true;
      confirmation.section.hidden = true;
    },
    cancel,
    handle(intents, move) {
      (pending === null ? menu : confirmMenu).handle(menuInput.edges(intents, move));
    },
  };
}

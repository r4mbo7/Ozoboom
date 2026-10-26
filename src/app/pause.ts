import { t } from '../shared/i18n';
import type { InputDevice, MenuIntents } from '../input/intents';
import type { Vec2 } from '../sim/state';
import { el, fillHint, setText } from '../ui/dom';
import { createMenu } from '../ui/menu';
import { createMenuInput } from '../ui/navigation';
import type { Prompts } from '../ui/prompts';

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

const pauseText = (): PauseText => ({
  heading: t('La piste t’attend'),
  text: t('Le set reprend là où tu l’as laissé.'),
});

export interface PauseItem {
  readonly label: string;
  // Built elsewhere, for an entry that must look the same on every screen.
  readonly element?: HTMLElement;
  // Asked before `activate`: « stay » goes back to the pause menu.
  readonly confirm?: PauseConfirmation;
  // Asked each time the pause shows; absent, the entry always is.
  shown?(): boolean;
  activate(): void;
  adjust?(side: -1 | 1): void;
}

export interface PauseScreen {
  readonly confirming: boolean;
  // For a pause that does not stop the set.
  show(device: InputDevice, text?: PauseText): void;
  hide(): void;
  cancelConfirmation(): void;
  // `back` is the caller's to handle.
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
  body.append(el('p', 'ui-kicker', t('Pause')), parts.heading, parts.text, parts.nav, parts.hint);
  section.append(body);
  return parts;
}

function button(className: string, label: string): HTMLButtonElement {
  const node = el('button', className, label);
  node.type = 'button';
  return node;
}

// The pause screen is the app's, but wears the interface's styles so that it reads as one of its screens.
export function createPauseScreen(
  root: HTMLElement,
  prompts: Prompts,
  items: readonly PauseItem[],
): PauseScreen {
  const layer = el('div', 'ui');
  const resting = pauseText();
  const main = view('dialog', resting.heading, resting.text);
  main.section.setAttribute('aria-label', t('Pause'));
  main.nav.setAttribute('aria-label', t('Menu de pause'));
  const confirmation = view('alertdialog', '', '');
  layer.append(main.section, confirmation.section);

  const menuInput = createMenuInput();
  let device: InputDevice = 'none';
  let pending: PauseItem | null = null;
  let visible: readonly PauseItem[] = items;

  const nodes = items.map(
    (item, index) =>
      item.element ??
      button(index === 0 ? 'ui-button ui-button--primary' : 'ui-button', item.label),
  );
  main.nav.append(...nodes);
  const menu = createMenu(
    (index) => {
      const item = visible[index];
      if (item?.confirm === undefined) {
        item?.activate();
      } else {
        ask(item, item.confirm);
      }
    },
    (index, side) => {
      const item = visible[index];
      item?.adjust?.(side);
      return item?.adjust !== undefined;
    },
  );

  const stay = button('ui-button ui-button--primary', '');
  const leave = button('ui-button', '');
  confirmation.nav.append(stay, leave);
  const confirmMenu = createMenu((index) => {
    if (index === 0) {
      cancelConfirmation();
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
    const shown = prompts.for(device);
    fillHint(
      confirmation.hint,
      [
        { keys: shown.navigate, label: t('naviguer') },
        { keys: [shown.confirm], label: t('valider') },
        { keys: [shown.back], label: asked.stay.toLowerCase() },
      ],
      shown.style,
    );
    confirmMenu.select(0);
    menuInput.open();
    main.section.hidden = true;
    confirmation.section.hidden = false;
  }

  function cancelConfirmation(): void {
    if (pending === null) {
      return;
    }
    menu.select(visible.indexOf(pending));
    pending = null;
    confirmation.section.hidden = true;
    main.section.hidden = false;
  }

  return {
    get confirming() {
      return pending !== null;
    },
    show(next, text = pauseText()) {
      device = next;
      nodes.forEach((node, index) => {
        node.hidden = !(items[index]?.shown?.() ?? true);
      });
      visible = items.filter((_, index) => nodes[index]?.hidden === false);
      menu.setItems(nodes.filter((node) => !node.hidden));
      setText(main.heading, text.heading);
      setText(main.text, text.text);
      const shown = prompts.for(device);
      const navigate = visible.length > 1 ? [{ keys: shown.navigate, label: t('naviguer') }] : [];
      fillHint(
        main.hint,
        [
          ...navigate,
          { keys: [shown.confirm], label: t('valider') },
          { keys: [device === 'gamepad' ? 'Start' : t('Échap')], label: t('reprendre') },
        ],
        shown.style,
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
    cancelConfirmation,
    handle(intents, move) {
      (pending === null ? menu : confirmMenu).handle(menuInput.edges(intents, move));
    },
  };
}

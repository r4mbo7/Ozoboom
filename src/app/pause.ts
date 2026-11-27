import { t } from '../shared/i18n';
import type { InputDevice, MenuIntents } from '../input/intents';
import type { Vec2 } from '../sim/state';
import { el, fillHint, setText } from '../ui/dom';
import { type Menu, createMenu } from '../ui/menu';
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
  heading: t('The floor is waiting'),
  text: t('The set picks up where you left it.'),
});

export interface PauseItem {
  readonly label: string;
  // Built elsewhere, for an entry that must look the same on every screen.
  readonly element?: HTMLElement;
  // Asked before `activate`: « stay » goes back to the pause menu.
  readonly confirm?: PauseConfirmation;
  // Asked each time the pause shows; absent, the entry always is.
  shown?(): boolean;
  // The rows of a page of its own, with Back under them, that the entry opens in place of `activate`.
  readonly opens?: readonly PauseItem[];
  activate?(): void;
  adjust?(side: -1 | 1): void;
}

export interface PauseScreen {
  // On a question or on a page an entry opened, which `back` leaves for the menu.
  readonly nested: boolean;
  // For a pause that does not stop the set.
  show(device: InputDevice, text?: PauseText): void;
  hide(): void;
  back(): void;
  // `back` is the caller's to handle.
  handle(menu: MenuIntents, move: Vec2): void;
}

interface View {
  section: HTMLElement;
  body: HTMLElement;
  heading: HTMLElement;
  text: HTMLElement;
  nav: HTMLElement;
  hint: HTMLElement;
}

// `aside` goes beside the menu, the hint under both.
function view(
  role: 'dialog' | 'alertdialog',
  heading: string,
  text: string,
  aside?: HTMLElement,
): View {
  const section = el('section', 'ui-screen ui-overlay');
  section.setAttribute('role', role);
  section.hidden = true;
  const body = el('div', 'pause');
  const parts: View = {
    section,
    body,
    heading: el('h2', 'ui-heading', heading),
    text: el('p', 'pause__text', text),
    nav: el('nav', 'pause__menu'),
    hint: el('p', 'ui-hint'),
  };
  const menu = el('div', 'pause__main');
  menu.append(el('p', 'ui-kicker', t('Pause')), parts.heading, parts.text, parts.nav);
  body.append(menu);
  if (aside !== undefined) {
    body.append(aside);
  }
  body.append(parts.hint);
  section.append(body);
  return parts;
}

function button(className: string, label: string): HTMLButtonElement {
  const node = el('button', className, label);
  node.type = 'button';
  return node;
}

const nodeOf = (item: PauseItem, primary: boolean): HTMLElement =>
  item.element ?? button(primary ? 'ui-button ui-button--primary' : 'ui-button', item.label);

interface PausePage {
  readonly entry: PauseItem;
  readonly view: View;
  readonly menu: Menu;
}

function pageOf(entry: PauseItem, rows: readonly PauseItem[], leave: () => void): PausePage {
  const shown = view('dialog', entry.label, '');
  shown.section.setAttribute('aria-label', entry.label);
  shown.nav.setAttribute('aria-label', entry.label);
  shown.nav.classList.add('pause__menu--page');
  shown.text.hidden = true;
  const back = button('ui-button', t('Back'));
  const nodes = [...rows.map((row) => nodeOf(row, false)), back];
  shown.nav.append(...nodes);
  const menu = createMenu(
    (index) => {
      const row = rows[index];
      if (row === undefined) {
        leave();
      } else {
        row.activate?.();
      }
    },
    (index, side) => {
      const row = rows[index];
      row?.adjust?.(side);
      return row?.adjust !== undefined;
    },
  );
  menu.setItems(nodes);
  return { entry, view: shown, menu };
}

// The pause screen is the app's, but wears the interface's styles so that it reads as one of its screens.
// `sheetFor`, asked each time the pause opens: what goes beside the menu, null for nothing.
export function createPauseScreen(
  root: HTMLElement,
  prompts: Prompts,
  items: readonly PauseItem[],
  sheetFor?: () => HTMLElement | null,
): PauseScreen {
  const layer = el('div', 'ui');
  const resting = pauseText();
  const sheet = el('aside', 'pause__sheet');
  sheet.hidden = true;
  const main = view('dialog', resting.heading, resting.text, sheet);
  main.section.setAttribute('aria-label', t('Pause'));
  main.nav.setAttribute('aria-label', t('Pause menu'));
  const confirmation = view('alertdialog', '', '');
  layer.append(main.section, confirmation.section);

  const menuInput = createMenuInput();
  let device: InputDevice = 'none';
  let pending: PauseItem | null = null;
  let opened: PausePage | null = null;
  let visible: readonly PauseItem[] = items;

  const nodes = items.map((item, index) => nodeOf(item, index === 0));
  main.nav.append(...nodes);
  const pages = new Map<PauseItem, PausePage>();
  for (const item of items) {
    if (item.opens !== undefined) {
      const page = pageOf(item, item.opens, leavePage);
      pages.set(item, page);
      layer.append(page.view.section);
    }
  }
  const menu = createMenu(
    (index) => {
      const item = visible[index];
      const page = item === undefined ? undefined : pages.get(item);
      if (page !== undefined) {
        openPage(page);
      } else if (item?.confirm === undefined) {
        item?.activate?.();
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
      pending?.activate?.();
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
        { keys: shown.navigate, label: t('navigate') },
        { keys: [shown.confirm], label: t('confirm') },
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

  function openPage(page: PausePage): void {
    opened = page;
    const shown = prompts.for(device);
    fillHint(
      page.view.hint,
      [
        { keys: shown.navigate, label: t('navigate') },
        { keys: shown.navigateRow, label: t('level') },
        { keys: [shown.confirm], label: t('confirm') },
        { keys: [shown.back], label: t('back') },
      ],
      shown.style,
    );
    page.menu.select(0);
    menuInput.open();
    main.section.hidden = true;
    page.view.section.hidden = false;
  }

  function leavePage(): void {
    if (opened === null) {
      return;
    }
    menu.select(visible.indexOf(opened.entry));
    opened.view.section.hidden = true;
    opened = null;
    menuInput.open();
    main.section.hidden = false;
  }

  return {
    get nested() {
      return pending !== null || opened !== null;
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
      const shownSheet = sheetFor?.() ?? null;
      sheet.replaceChildren(...(shownSheet === null ? [] : [shownSheet]));
      sheet.hidden = shownSheet === null;
      main.body.toggleAttribute('data-sheet', shownSheet !== null);
      const shown = prompts.for(device);
      const navigate = visible.length > 1 ? [{ keys: shown.navigate, label: t('navigate') }] : [];
      fillHint(
        main.hint,
        [
          ...navigate,
          { keys: [shown.confirm], label: t('confirm') },
          { keys: [device === 'gamepad' ? 'Start' : t('Esc')], label: t('resume') },
        ],
        shown.style,
      );
      menu.select(0);
      menuInput.open();
      main.section.hidden = false;
    },
    hide() {
      pending = null;
      opened = null;
      main.section.hidden = true;
      confirmation.section.hidden = true;
      for (const page of pages.values()) {
        page.view.section.hidden = true;
      }
    },
    back() {
      if (pending === null) {
        leavePage();
      } else {
        cancelConfirmation();
      }
    },
    handle(intents, move) {
      const current = pending === null ? (opened?.menu ?? menu) : confirmMenu;
      current.handle(menuInput.edges(intents, move));
    },
  };
}

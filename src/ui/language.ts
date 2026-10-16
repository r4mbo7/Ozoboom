import type { InputDevice, MenuIntents } from '../input/intents';
import { LOCALES, type Locale, t } from '../shared/i18n';
import { el, fillHint, icon } from './dom';
import { createMenu } from './menu';
import { promptsFor } from './prompts';

const CHECK =
  '<path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>';

const nameOf = (locale: Locale): string =>
  LOCALES.find((entry) => entry.id === locale)?.name ?? locale;

// The row of the title that opens the list. Each language is written in itself, for a player who
// does not read the current one.
export function createLanguageControl(current: Locale): HTMLButtonElement {
  const button = el('button', 'ui-button ui-toggle ui-language');
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  const text = el('span', 'ui-toggle__text');
  text.append(
    el('span', 'ui-toggle__label', t('Langue')),
    el('span', 'ui-toggle__hint', t('Le jeu se recharge')),
  );
  const state = el('span', 'ui-toggle__state', nameOf(current));
  state.lang = current;
  button.append(text, state);
  return button;
}

export interface LanguageList {
  readonly element: HTMLElement;
  readonly isOpen: boolean;
  open(): void;
  setDevice(device: InputDevice): void;
  handle(edges: MenuIntents): void;
}

// Every language of the game, over the title. A choice reloads the game in it; `close` gives the
// title back unchanged.
export function createLanguageList(
  current: Locale,
  choose: (locale: Locale) => void,
  close: () => void,
): LanguageList {
  const element = el('section', 'ui-screen ui-overlay ui-languages');
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-label', t('Langue'));
  element.hidden = true;
  const body = el('div', 'ui-languages__body');
  const group = el('div', 'ui-languages__list');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', t('Langues du jeu'));
  const items = LOCALES.map((entry) => {
    const item = el('button', 'ui-button', entry.name);
    item.type = 'button';
    item.lang = entry.id;
    item.setAttribute('role', 'radio');
    item.setAttribute('aria-checked', String(entry.id === current));
    if (entry.id === current) {
      item.append(icon('ui-languages__check', CHECK));
    }
    return item;
  });
  group.append(...items);
  const hint = el('p', 'ui-hint');
  body.append(el('h2', 'ui-heading', t('Langue')), group, hint);
  element.append(body);

  function hide(): void {
    element.hidden = true;
    close();
  }

  const menu = createMenu((index) => {
    const chosen = LOCALES[index]?.id;
    if (chosen === undefined || chosen === current) {
      hide();
    } else {
      choose(chosen);
    }
  });
  menu.setItems(items);
  // A touch screen has no back key: a touch beside the list closes it.
  element.addEventListener('click', (event) => {
    if (event.target === element) {
      hide();
    }
  });

  return {
    element,
    get isOpen() {
      return !element.hidden;
    },
    open() {
      menu.select(LOCALES.findIndex((entry) => entry.id === current));
      element.hidden = false;
    },
    setDevice(device) {
      const prompts = promptsFor(device);
      fillHint(
        hint,
        [
          { keys: prompts.navigate, label: t('naviguer') },
          { keys: [prompts.confirm], label: t('valider') },
          { keys: [prompts.back], label: t('retour') },
        ],
        prompts.style,
      );
    },
    handle(edges) {
      if (edges.back) {
        hide();
      } else {
        menu.handle(edges);
      }
    },
  };
}

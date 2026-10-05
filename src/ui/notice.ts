import type { InputDevice } from '../input/intents';
import { el, fillHint, setText } from './dom';
import { type Menu, createMenu } from './menu';
import { promptsFor } from './prompts';

export interface NoticeScreen {
  readonly element: HTMLElement;
  readonly menu: Menu;
  show(kicker: string, title: string, text: string): void;
  setDevice(device: InputDevice): void;
}

export function createNotice(label: string, onBack: () => void): NoticeScreen {
  const element = el('section', 'ui-screen ui-overlay ui-end');
  element.dataset.outcome = 'lost';
  element.setAttribute('aria-label', label);
  const kicker = el('p', 'ui-kicker');
  const title = el('h2', 'ui-end__title');
  const text = el('p', 'ui-end__text');
  const back = el('button', 'ui-button ui-button--primary', 'Retour au titre');
  back.type = 'button';
  const actions = el('div', 'ui-end__actions');
  actions.append(back);
  const hint = el('p', 'ui-hint');
  const body = el('div', 'ui-end__body');
  body.append(kicker, title, text, actions, hint);
  element.append(body);

  const menu = createMenu(onBack);
  menu.setItems([back]);

  let device: InputDevice | null = null;

  return {
    element,
    menu,
    show(nextKicker, nextTitle, nextText) {
      setText(kicker, nextKicker);
      setText(title, nextTitle);
      setText(text, nextText);
      menu.select(0);
    },
    setDevice(next) {
      if (next === device) {
        return;
      }
      device = next;
      const prompts = promptsFor(next);
      fillHint(hint, [{ keys: [prompts.confirm], label: 'valider' }], prompts.style);
    },
  };
}

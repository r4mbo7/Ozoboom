import type { InputDevice } from '../input/intents';
import type { SimState } from '../sim/state';
import { el, fillHint, icon, setText } from './dom';
import { createFeedbackButton } from './feedback-button';
import { endStats } from './format';
import { FOG, SUN } from './icons';
import { type Menu, createMenu } from './menu';
import { promptsFor } from './prompts';

export interface EndScreen {
  readonly element: HTMLElement;
  readonly menu: Menu;
  show(state: SimState): void;
  setDevice(device: InputDevice): void;
}

const WON = {
  title: 'Sunrise\u202f!',
  text: 'Le soleil se lève sur le dancefloor. Le sound system a tenu toute la nuit.',
};

const LOST = {
  title: 'La musique s’arrête',
  text: 'Les bad vibes ont eu raison du sound system. On rebranche et on y retourne\u202f?',
};

export function createEnd(onRestart: () => void, onFeedback?: () => void): EndScreen {
  const element = el('section', 'ui-screen ui-overlay ui-end');
  element.setAttribute('aria-label', 'Fin de partie');
  const emblem = el('div', 'ui-end__emblem');
  const title = el('h2', 'ui-end__title');
  const text = el('p', 'ui-end__text');
  const stats = el('dl', 'ui-stats');
  const restart = el('button', 'ui-button ui-button--primary', 'Rejouer');
  restart.type = 'button';
  const items = [restart];
  if (onFeedback !== undefined) {
    items.push(createFeedbackButton());
  }
  const actions = el('div', 'ui-end__actions');
  actions.append(...items);
  const hint = el('p', 'ui-hint');
  const body = el('div', 'ui-end__body');
  body.append(emblem, title, text, stats, actions, hint);
  element.append(body);

  const menu = createMenu((index) => {
    if (index === 0) {
      onRestart();
    } else {
      onFeedback?.();
    }
  });
  menu.setItems(items);

  let device: InputDevice | null = null;

  return {
    element,
    menu,
    show(state) {
      const won = state.status === 'won';
      element.dataset.outcome = won ? 'won' : 'lost';
      emblem.replaceChildren(icon('ui-end__icon', won ? SUN : FOG));
      setText(title, won ? WON.title : LOST.title);
      setText(text, won ? WON.text : LOST.text);
      stats.replaceChildren(
        ...endStats(state).map((stat) => {
          const item = el('div', 'ui-stats__item');
          item.append(
            el('dt', 'ui-stats__label', stat.label),
            el('dd', 'ui-stats__value', stat.value),
          );
          return item;
        }),
      );
      menu.select(0);
    },
    setDevice(next) {
      if (next === device) {
        return;
      }
      device = next;
      const prompts = promptsFor(next);
      fillHint(
        hint,
        items.length > 1
          ? [
              { keys: prompts.navigate, label: 'naviguer' },
              { keys: [prompts.confirm], label: 'valider' },
            ]
          : [{ keys: [prompts.confirm], label: 'rejouer' }],
        prompts.style,
      );
    },
  };
}

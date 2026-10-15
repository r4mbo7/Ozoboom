import type { InputDevice } from '../input/intents';
import { el, fillHint, icon, setText } from './dom';
import { createFeedbackButton } from './feedback-button';
import { type Menu, createMenu } from './menu';
import { promptsFor } from './prompts';

export interface NoticeScreen {
  readonly element: HTMLElement;
  readonly menu: Menu;
  // `glyph` is the body of an icon for the emblem, `detail` a line of facts to report.
  show(
    kicker: string,
    title: string,
    text: string,
    extra?: { glyph?: string; detail?: string },
  ): void;
  setDevice(device: InputDevice): void;
}

// `onFeedback` adds the « Ton avis » button, which gets the detail the screen shows.
export function createNotice(
  label: string,
  onBack: () => void,
  onFeedback?: (detail: string) => void,
): NoticeScreen {
  const element = el('section', 'ui-screen ui-overlay ui-end ui-notice');
  element.dataset.outcome = 'lost';
  element.setAttribute('aria-label', label);
  const emblem = el('div', 'ui-end__emblem');
  const kicker = el('p', 'ui-kicker');
  const title = el('h2', 'ui-end__title');
  const text = el('p', 'ui-end__text');
  const detail = el('p', 'ui-notice__detail');
  const back = el('button', 'ui-button ui-button--primary', 'Retour au titre');
  back.type = 'button';
  const feedback = onFeedback === undefined ? null : createFeedbackButton();
  const items = feedback === null ? [back] : [back, feedback];
  const actions = el('div', 'ui-end__actions');
  actions.append(...items);
  const hint = el('p', 'ui-hint');
  const body = el('div', 'ui-end__body');
  body.append(emblem, kicker, title, text, detail, actions, hint);
  element.append(body);

  const menu = createMenu((index) => {
    if (index === 0) {
      onBack();
    } else {
      onFeedback?.(detail.textContent);
    }
  });
  menu.setItems(items);

  let device: InputDevice | null = null;

  return {
    element,
    menu,
    show(nextKicker, nextTitle, nextText, extra) {
      setText(kicker, nextKicker);
      setText(title, nextTitle);
      setText(text, nextText);
      setText(detail, extra?.detail ?? '');
      detail.hidden = (extra?.detail ?? '') === '';
      emblem.hidden = extra?.glyph === undefined;
      emblem.replaceChildren(
        ...(extra?.glyph === undefined ? [] : [icon('ui-end__icon', extra.glyph)]),
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
        [
          ...(items.length > 1 ? [{ keys: prompts.navigate, label: 'naviguer' }] : []),
          { keys: [prompts.confirm], label: 'valider' },
        ],
        prompts.style,
      );
    },
  };
}

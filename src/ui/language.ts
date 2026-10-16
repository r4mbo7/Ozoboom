import { LOCALES, type Locale, t } from '../shared/i18n';
import { stepperArrow } from './class-picker';
import { el, setText } from './dom';

export interface LanguageControl {
  readonly element: HTMLElement;
  set(locale: Locale): void;
}

function arrow(label: string, flipped: boolean, onClick: () => void): HTMLButtonElement {
  const button = stepperArrow(label, flipped);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

// A click on it, left and right or its arrows go to another language. Each one is written in
// itself, for a player who does not read the current one.
export function createLanguageControl(onStep: (side: -1 | 1) => void): LanguageControl {
  const element = el('div', 'ui-button ui-toggle ui-language');
  element.setAttribute('role', 'button');
  const text = el('span', 'ui-toggle__text');
  text.append(
    el('span', 'ui-toggle__label', t('Langue')),
    el('span', 'ui-toggle__hint', t('Le jeu se recharge')),
  );
  const state = el('span', 'ui-toggle__state');
  const control = el('span', 'ui-toggle__control ui-language__control');
  control.append(
    arrow(t('Langue précédente'), false, () => {
      onStep(-1);
    }),
    state,
    arrow(t('Langue suivante'), true, () => {
      onStep(1);
    }),
  );
  element.append(text, control);
  return {
    element,
    set(locale) {
      const entry = LOCALES.find((candidate) => candidate.id === locale);
      setText(state, entry?.name ?? locale);
      state.lang = locale;
    },
  };
}

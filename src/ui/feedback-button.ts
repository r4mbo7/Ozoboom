import { t } from '../shared/i18n';
import { el, icon } from './dom';
import { SPEECH } from './icons';

export function createActionButton(
  label: string,
  hint: string,
  svgBody: string,
): HTMLButtonElement {
  const button = el('button', 'ui-button ui-action');
  button.type = 'button';
  const text = el('span', 'ui-action__text');
  text.append(el('span', 'ui-action__label', label), el('span', 'ui-action__hint', hint));
  button.append(text, icon('ui-action__icon', svgBody));
  return button;
}

export function createFeedbackButton(): HTMLButtonElement {
  return createActionButton(t('Ton avis'), t('Une idée, un bug ? Dis-le-nous'), SPEECH);
}

import { el, icon } from './dom';
import { SPEECH } from './icons';

export function createFeedbackButton(): HTMLButtonElement {
  const button = el('button', 'ui-button ui-action');
  button.type = 'button';
  const text = el('span', 'ui-action__text');
  text.append(
    el('span', 'ui-action__label', 'Ton avis'),
    el('span', 'ui-action__hint', 'Une idée, un bug ? Dis-le-nous'),
  );
  button.append(text, icon('ui-action__icon', SPEECH));
  return button;
}

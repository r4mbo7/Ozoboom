import { t } from '../shared/i18n';
import { el } from './dom';

// In place of the game when its renderer cannot start, in the look of the interruption notice:
// what happened, what to try, and a button that reloads the page.
export function showRendererUnavailable(
  root: Pick<HTMLElement, 'append'>,
  reload: () => void,
): void {
  const screen = el('section', 'ui-screen ui-overlay ui-end ui-notice ui-unavailable');
  screen.dataset.outcome = 'lost';
  screen.setAttribute('role', 'alert');
  const reloadButton = el('button', 'ui-button ui-button--primary', t('Reload'));
  reloadButton.type = 'button';
  reloadButton.addEventListener('click', reload);
  const actions = el('div', 'ui-end__actions');
  actions.append(reloadButton);
  const body = el('div', 'ui-end__body');
  body.append(
    el('p', 'ui-kicker', t('Oops')),
    el('h2', 'ui-end__title', t('The game couldn’t start')),
    el(
      'p',
      'ui-end__text',
      t('Your browser couldn’t launch the game. Reload the page in a moment.'),
    ),
    el(
      'p',
      'ui-notice__detail',
      t(
        'If it happens again: close other tabs, turn on hardware acceleration in your browser settings, or try another browser. (WebGL unavailable)',
      ),
    ),
    actions,
  );
  screen.append(body);
  const container = el('div', 'ui');
  container.append(screen);
  root.append(container);
  reloadButton.focus();
}

import { t } from '../shared/i18n';
import { type Toggle, createToggle } from './toggle';

export interface EndlessToggle {
  readonly toggle: Toggle;
  set(on: boolean, shown: boolean): void;
}

export function createEndlessToggle(onToggle: (on: boolean) => void): EndlessToggle {
  const toggle = createToggle(
    t('Endless'),
    t('After the last boss, the night goes on'),
    t('On'),
    t('Off'),
  );
  toggle.button.classList.add('ui-toggle--endless');
  toggle.button.tabIndex = -1;
  let on = false;
  toggle.button.addEventListener('click', (event) => {
    event.stopPropagation();
    onToggle(!on);
  });
  return {
    toggle,
    set(nextOn, shown) {
      on = nextOn;
      toggle.set(on);
      toggle.button.hidden = !shown;
    },
  };
}

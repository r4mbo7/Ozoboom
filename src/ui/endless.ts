import { t } from '../shared/i18n';
import { type Toggle, createToggle } from './toggle';

export interface EndlessToggle {
  readonly toggle: Toggle;
  set(on: boolean, shown: boolean): void;
}

export function createEndlessToggle(onToggle: (on: boolean) => void): EndlessToggle {
  const toggle = createToggle(
    t('Sans fin'),
    t('Après le dernier boss, la nuit continue'),
    t('Oui'),
    t('Non'),
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

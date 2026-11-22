import { t } from '../shared/i18n';
import { el, setText } from './dom';

export interface Toggle {
  button: HTMLButtonElement;
  set(on: boolean): void;
}

export function createToggle(label: string, hint: string, onText: string, offText: string): Toggle {
  const button = el('button', 'ui-button ui-toggle');
  button.type = 'button';
  button.setAttribute('role', 'switch');
  const text = el('span', 'ui-toggle__text');
  text.append(el('span', 'ui-toggle__label', label), el('span', 'ui-toggle__hint', hint));
  const control = el('span', 'ui-toggle__control');
  const state = el('span', 'ui-toggle__state');
  const track = el('span', 'ui-switch');
  track.append(el('span', 'ui-switch__knob'));
  control.append(state, track);
  button.append(text, control);
  return {
    button,
    set(on) {
      button.setAttribute('aria-checked', String(on));
      setText(state, on ? onText : offText);
    },
  };
}

export function createHitSoundToggle(): Toggle {
  return createToggle(t('Hit sound'), t('A note for every hit'), t('On'), t('Off'));
}

// The touch screen always fires and aims by itself: these switches only show elsewhere.
export function createAutoFireToggle(): Toggle {
  return assistToggle(t('Auto fire'), t('Without holding fire'));
}

export function createAutoAimToggle(): Toggle {
  return assistToggle(t('Auto aim'), t('At the bad vibe in range'));
}

function assistToggle(label: string, hint: string): Toggle {
  const toggle = createToggle(label, hint, t('On'), t('Off'));
  toggle.button.classList.add('ui-toggle--assist');
  return toggle;
}

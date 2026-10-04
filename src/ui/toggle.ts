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

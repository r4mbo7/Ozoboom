import { t } from '../shared/i18n';
import { el } from './dom';
import { NAME_LENGTH, seatName } from './lobby-model';

// The text field of the player's pseudo; Enter and Escape both leave it.
export function createPseudoInput(
  label: string,
  keys: { readonly enter?: (pseudo: string) => void; readonly escape?: () => void },
): HTMLInputElement {
  const input = el('input', 'ui-lobby__input ui-pseudo__input');
  input.type = 'text';
  input.maxLength = NAME_LENGTH;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = t('Your name');
  input.setAttribute('aria-label', label);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
      keys.enter?.(seatName(input.value));
    } else if (event.key === 'Escape') {
      event.preventDefault();
      keys.escape?.();
      input.blur();
    }
  });
  return input;
}

// Into the field from the menu: its text selected, unless the player already types in it.
export function editPseudo(input: HTMLInputElement): void {
  if (document.activeElement !== input) {
    input.focus();
    input.select();
  }
}

export interface PseudoSetting {
  // A label, not a button: a button cannot hold a field.
  readonly row: HTMLLabelElement;
  readonly input: HTMLInputElement;
  set(pseudo: string): void;
}

// The Réglages row of the pseudo, the player's name online and on the leaderboard. Leaving the
// field keeps what was typed; Escape gives it up.
export function createPseudoSetting(commit: (pseudo: string) => void): PseudoSetting {
  const row = el('label', 'ui-button ui-toggle ui-pseudo');
  const text = el('span', 'ui-toggle__text');
  text.append(
    el('span', 'ui-toggle__label', t('Pseudo')),
    el('span', 'ui-toggle__hint', t('Your name for the other players')),
  );
  let saved = '';
  const input = createPseudoInput(t('Pseudo'), {
    escape: () => {
      input.value = saved;
    },
  });
  input.addEventListener('blur', () => {
    const pseudo = seatName(input.value);
    input.value = pseudo;
    if (pseudo !== saved) {
      saved = pseudo;
      commit(pseudo);
    }
  });
  row.append(text, input);
  return {
    row,
    input,
    set(pseudo) {
      saved = pseudo;
      if (document.activeElement !== input) {
        input.value = pseudo;
      }
    },
  };
}

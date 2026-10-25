import { type KeyNames, buttonName } from '../input/key-names';
import {
  DEFAULT_KEY_PROFILE,
  GAMEPAD_ACTIONS,
  type GamepadAction,
  type KeyProfile,
  type KeyboardAction,
  type Rebound,
  type Slot,
} from '../input/profile';
import { isOneOf } from '../shared/guards';
import { t } from '../shared/i18n';

export type Tab = 'keyboard' | 'gamepad';

export type Action = KeyboardAction | GamepadAction;

export const ACTION_NAMES: Readonly<Record<Action, () => string>> = {
  moveUp: () => t('Haut'),
  moveDown: () => t('Bas'),
  moveLeft: () => t('Gauche'),
  moveRight: () => t('Droite'),
  fire: () => t('Tirer'),
  placeTrap: () => t('Poser le piège'),
  skill: () => t('Spéciale'),
  dash: () => t('Dash'),
  nextTrap: () => t('Piège suivant'),
  previousTrap: () => t('Piège précédent'),
};

export function inputOf(
  profile: KeyProfile,
  on: Tab,
  action: Action,
  slot: Slot,
): string | number | null {
  if (on === 'keyboard') {
    return profile.keyboard[action][slot];
  }
  return isOneOf(action, GAMEPAD_ACTIONS) ? profile.gamepad[action][slot] : null;
}

export function nameOf(
  on: Tab,
  input: string | number | null,
  names: Pick<KeyNames, 'of'>,
): string {
  if (input === null) {
    return '';
  }
  return on === 'keyboard' ? names.of(String(input)) : buttonName(Number(input));
}

export function defaultsFor(profile: KeyProfile, tab: Tab): KeyProfile {
  return tab === 'keyboard'
    ? { ...profile, keyboard: DEFAULT_KEY_PROFILE.keyboard }
    : { ...profile, gamepad: DEFAULT_KEY_PROFILE.gamepad, swapSticks: false };
}

export function fixedKeysText(tab: Tab): string {
  return tab === 'keyboard'
    ? t(
        'Toujours là : Échap pour la pause, 1 à 5 pour les pièges, les flèches et Entrée dans les menus.',
      )
    : t('Toujours là : Start pour la pause, la croix pour les gestes, A et B dans les menus.');
}

export function listenText(on: Tab, action: Action): string {
  return on === 'keyboard'
    ? t('{action} : appuie sur une touche, un bouton de la souris ou la molette.', {
        action: ACTION_NAMES[action](),
      })
    : t('{action} : appuie sur un bouton de la manette.', { action: ACTION_NAMES[action]() });
}

export interface Settled {
  readonly on: Tab;
  readonly action: Action;
  readonly input: string | number | null;
  readonly moved: Rebound<Action>['moved'];
  readonly replaced: string | number | null;
}

export function settledText(
  { on, action, input, moved, replaced }: Settled,
  names: Pick<KeyNames, 'of'>,
): string {
  const name = ACTION_NAMES[action]();
  if (input === null) {
    return t('{action} : case vidée.', { action: name });
  }
  if (moved === null) {
    return t('{key} va à {action}.', { key: nameOf(on, input, names), action: name });
  }
  if (replaced === null) {
    return t('{key} va à {action} et quitte {other}.', {
      key: nameOf(on, input, names),
      action: name,
      other: ACTION_NAMES[moved.action](),
    });
  }
  return t('{key} va à {action}, {other} prend {old}.', {
    key: nameOf(on, input, names),
    action: name,
    other: ACTION_NAMES[moved.action](),
    old: nameOf(on, replaced, names),
  });
}

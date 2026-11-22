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
  moveUp: () => t('Up'),
  moveDown: () => t('Down'),
  moveLeft: () => t('Left'),
  moveRight: () => t('Right'),
  fire: () => t('Shoot'),
  placeTrap: () => t('Move a trap'),
  skill: () => t('Special'),
  dash: () => t('Dash'),
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
    ? t('Always there: Esc to pause, the arrows and Enter in the menus.')
    : t('Always there: Start to pause, the D-pad for emotes, A and B in the menus.');
}

export function listenText(on: Tab, action: Action): string {
  return on === 'keyboard'
    ? t('{action}: press a key, a mouse button or the wheel.', {
        action: ACTION_NAMES[action](),
      })
    : t('{action}: press a gamepad button.', { action: ACTION_NAMES[action]() });
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
    return t('{action}: slot cleared.', { action: name });
  }
  if (moved === null) {
    return t('{key} goes to {action}.', { key: nameOf(on, input, names), action: name });
  }
  if (replaced === null) {
    return t('{key} goes to {action} and leaves {other}.', {
      key: nameOf(on, input, names),
      action: name,
      other: ACTION_NAMES[moved.action](),
    });
  }
  return t('{key} goes to {action}, {other} takes {old}.', {
    key: nameOf(on, input, names),
    action: name,
    other: ACTION_NAMES[moved.action](),
    old: nameOf(on, replaced, names),
  });
}

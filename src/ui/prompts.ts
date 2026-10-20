import { t } from '../shared/i18n';
import type { InputDevice } from '../input/intents';
import { buttonName, inputName, keyNamesVersion } from '../input/key-names';
import {
  type GamepadAction,
  type KeyProfile,
  type KeyboardAction,
  keyProfile,
  keyProfileVersion,
} from '../input/profile';

export type KeyStyle = 'key' | 'button';

export interface Control {
  action: string;
  keys: readonly string[];
}

export interface DevicePrompts {
  name: string;
  style: KeyStyle;
  // Through a list from top to bottom, and through items side by side.
  navigate: readonly string[];
  navigateRow: readonly string[];
  // The tab before and the tab after, on a screen with tabs.
  tabs: readonly string[];
  confirm: string;
  back: string;
  skill: string;
  controls: readonly Control[];
}

const keyboard = (): DevicePrompts => ({
  name: t('Clavier et souris'),
  style: 'key',
  navigate: ['↑', '↓'],
  navigateRow: ['←', '→'],
  tabs: [t('Maj+Tab'), 'Tab'],
  confirm: t('Entrée'),
  back: t('Échap'),
  skill: keyNames(keyProfile(), 'skill')[0] ?? '',
  controls: [
    { action: t('Se déplacer'), keys: moveKeys(keyProfile()) },
    { action: t('Viser'), keys: [t('Souris')] },
    { action: t('Tirer'), keys: keyNames(keyProfile(), 'fire') },
    { action: t('Choisir un piège'), keys: [...trapKeys(keyProfile()), t('1 à 5')] },
    { action: t('Poser le piège'), keys: keyNames(keyProfile(), 'placeTrap') },
    { action: t('Spéciale'), keys: keyNames(keyProfile(), 'skill') },
    { action: t('Dash'), keys: keyNames(keyProfile(), 'dash') },
    { action: t('Pause'), keys: [t('Échap')] },
  ],
});

const gamepad = (): DevicePrompts => ({
  name: t('Manette'),
  style: 'button',
  navigate: [sticks(keyProfile()).move, t('Croix')],
  navigateRow: [sticks(keyProfile()).move, t('Croix')],
  tabs: ['LB', 'RB'],
  confirm: 'A',
  back: 'B',
  skill: buttonNames(keyProfile(), 'skill')[0] ?? '',
  controls: [
    { action: t('Se déplacer'), keys: [sticks(keyProfile()).move] },
    { action: t('Viser'), keys: [sticks(keyProfile()).aim] },
    { action: t('Tirer'), keys: buttonNames(keyProfile(), 'fire') },
    {
      action: t('Choisir un piège'),
      keys: [
        ...buttonNames(keyProfile(), 'previousTrap'),
        ...buttonNames(keyProfile(), 'nextTrap'),
      ],
    },
    { action: t('Poser le piège'), keys: buttonNames(keyProfile(), 'placeTrap') },
    { action: t('Spéciale'), keys: buttonNames(keyProfile(), 'skill') },
    { action: t('Dash'), keys: buttonNames(keyProfile(), 'dash') },
    { action: t('Pause'), keys: ['Start'] },
  ],
});

// Menus are touched, not walked: a touch screen shows no key hints and no skill key.
const touch = (): DevicePrompts => ({
  name: t('Tactile'),
  style: 'key',
  navigate: [],
  navigateRow: [],
  tabs: [],
  confirm: t('Toucher'),
  back: t('Retour'),
  skill: '',
  controls: [
    { action: t('Se déplacer'), keys: [t('Glisser sur l’arène')] },
    { action: t('Viser et tirer'), keys: [t('Automatique')] },
    { action: t('Poser un piège à ses pieds'), keys: [t('Toucher sa tuile')] },
    { action: t('Le poser ailleurs'), keys: [t('Glisser sa tuile')] },
    { action: t('Spéciale'), keys: [t('Toucher sa tuile')] },
    { action: t('Dash'), keys: [t('Toucher sa tuile')] },
    { action: t('Pause'), keys: ['❚❚'] },
  ],
});

function keyNames(profile: KeyProfile, action: KeyboardAction): string[] {
  return profile.keyboard[action].flatMap((input) => (input === null ? [] : [inputName(input)]));
}

function buttonNames(profile: KeyProfile, action: GamepadAction): string[] {
  return profile.gamepad[action].flatMap((button) => (button === null ? [] : [buttonName(button)]));
}

const ARROWS = '↑←↓→';

// Each slot of the four directions as one word, ZQSD on an AZERTY keyboard; a slot that does not
// move all four ways shows its keys one by one. The arrows, which also walk the menus, only show
// when no other word does.
function moveKeys(profile: KeyProfile): string[] {
  const directions = ['moveUp', 'moveLeft', 'moveDown', 'moveRight'] as const;
  const slots = ([0, 1] as const).map((slot) =>
    directions.flatMap((action) => {
      const input = profile.keyboard[action][slot];
      return input === null ? [] : [inputName(input)];
    }),
  );
  const words = slots.flatMap((names) => {
    return names.length === directions.length && names.every((name) => name.length === 1)
      ? [names.join('')]
      : names;
  });
  const others = words.filter((word) => word !== ARROWS);
  return others.length > 0 ? others : words;
}

// The wheel turns both ways: one name for the two, else the first key of each way.
function trapKeys(profile: KeyProfile): string[] {
  const [next] = profile.keyboard.nextTrap.filter((input) => input !== null);
  const [previous] = profile.keyboard.previousTrap.filter((input) => input !== null);
  if (next === 'WheelDown' && previous === 'WheelUp') {
    return [t('Molette')];
  }
  return [next, previous].flatMap((input) => (input === undefined ? [] : [inputName(input)]));
}

function sticks(profile: KeyProfile): { move: string; aim: string } {
  const left = t('Stick gauche');
  const right = t('Stick droit');
  return profile.swapSticks ? { move: right, aim: left } : { move: left, aim: right };
}

// Changes when the keys the prompts show do: the player chose others, or the keyboard told its names.
export function promptsVersion(): number {
  return keyProfileVersion() + keyNamesVersion();
}

export function promptsFor(device: InputDevice): DevicePrompts {
  switch (device) {
    case 'gamepad':
      return gamepad();
    case 'touch':
      return touch();
    default:
      return keyboard();
  }
}

// The keys that reach the endless switch under the cards of a picker: none to show when they are
// the keys that choose a card, or on a touch screen.
export function endlessHint(
  prompts: DevicePrompts,
  night = false,
): { keys: readonly string[]; label: string }[] {
  const same = prompts.navigate.join() === prompts.navigateRow.join();
  return same ? [] : [{ keys: prompts.navigate, label: night ? t('la nuit') : t('sans fin') }];
}

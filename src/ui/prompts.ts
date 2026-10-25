import { t } from '../shared/i18n';
import type { InputDevice } from '../input/intents';
import { type KeyNames, buttonName } from '../input/key-names';
import type { GamepadAction, KeyProfile, KeyboardAction, PlayerKeys } from '../input/profile';

export type KeyStyle = 'key' | 'button';

export interface Control {
  action: string;
  keys: readonly string[];
}

export interface DevicePrompts {
  name: string;
  style: KeyStyle;
  // `navigate` walks a list from top to bottom, `navigateRow` items side by side.
  navigate: readonly string[];
  navigateRow: readonly string[];
  tabs: readonly string[];
  confirm: string;
  back: string;
  skill: string;
  controls: readonly Control[];
}

export interface Prompts {
  for(device: InputDevice): DevicePrompts;
  // Changes when the keys the prompts show do: the player chose others, or the keyboard told its names.
  version(): number;
}

type Name = (input: string) => string;

const keyboard = (profile: KeyProfile, name: Name): DevicePrompts => ({
  name: t('Clavier et souris'),
  style: 'key',
  navigate: ['↑', '↓'],
  navigateRow: ['←', '→'],
  tabs: [t('Maj+Tab'), 'Tab'],
  confirm: t('Entrée'),
  back: t('Échap'),
  skill: keyNames(profile, 'skill', name)[0] ?? '',
  controls: [
    { action: t('Se déplacer'), keys: moveKeys(profile, name) },
    { action: t('Viser'), keys: [t('Souris')] },
    { action: t('Tirer'), keys: keyNames(profile, 'fire', name) },
    { action: t('Choisir un piège'), keys: [...trapKeys(profile, name), t('1 à 5')] },
    { action: t('Poser le piège'), keys: keyNames(profile, 'placeTrap', name) },
    { action: t('Spéciale'), keys: keyNames(profile, 'skill', name) },
    { action: t('Dash'), keys: keyNames(profile, 'dash', name) },
    { action: t('Pause'), keys: [t('Échap')] },
  ],
});

const gamepad = (profile: KeyProfile): DevicePrompts => ({
  name: t('Manette'),
  style: 'button',
  navigate: [sticks(profile).move, t('Croix')],
  navigateRow: [sticks(profile).move, t('Croix')],
  tabs: ['LB', 'RB'],
  confirm: 'A',
  back: 'B',
  skill: buttonNames(profile, 'skill')[0] ?? '',
  controls: [
    { action: t('Se déplacer'), keys: [sticks(profile).move] },
    { action: t('Viser'), keys: [sticks(profile).aim] },
    { action: t('Tirer'), keys: buttonNames(profile, 'fire') },
    {
      action: t('Choisir un piège'),
      keys: [...buttonNames(profile, 'previousTrap'), ...buttonNames(profile, 'nextTrap')],
    },
    { action: t('Poser le piège'), keys: buttonNames(profile, 'placeTrap') },
    { action: t('Spéciale'), keys: buttonNames(profile, 'skill') },
    { action: t('Dash'), keys: buttonNames(profile, 'dash') },
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

function keyNames(profile: KeyProfile, action: KeyboardAction, name: Name): string[] {
  return profile.keyboard[action].flatMap((input) => (input === null ? [] : [name(input)]));
}

function buttonNames(profile: KeyProfile, action: GamepadAction): string[] {
  return profile.gamepad[action].flatMap((button) => (button === null ? [] : [buttonName(button)]));
}

const ARROWS = '↑←↓→';

// ZQSD on an AZERTY keyboard; the arrows, which also walk the menus, only show when no other word does.
function moveKeys(profile: KeyProfile, name: Name): string[] {
  const directions = ['moveUp', 'moveLeft', 'moveDown', 'moveRight'] as const;
  const slots = ([0, 1] as const).map((slot) =>
    directions.flatMap((action) => {
      const input = profile.keyboard[action][slot];
      return input === null ? [] : [name(input)];
    }),
  );
  const words = slots.flatMap((names) => {
    return names.length === directions.length && names.every((one) => one.length === 1)
      ? [names.join('')]
      : names;
  });
  const others = words.filter((word) => word !== ARROWS);
  return others.length > 0 ? others : words;
}

// The wheel turns both ways: one name for the two, else the first key of each way.
function trapKeys(profile: KeyProfile, name: Name): string[] {
  const [next] = profile.keyboard.nextTrap.filter((input) => input !== null);
  const [previous] = profile.keyboard.previousTrap.filter((input) => input !== null);
  if (next === 'WheelDown' && previous === 'WheelUp') {
    return [t('Molette')];
  }
  return [next, previous].flatMap((input) => (input === undefined ? [] : [name(input)]));
}

function sticks(profile: KeyProfile): { move: string; aim: string } {
  const left = t('Stick gauche');
  const right = t('Stick droit');
  return profile.swapSticks ? { move: right, aim: left } : { move: left, aim: right };
}

export function createPrompts(
  keys: Pick<PlayerKeys, 'profile' | 'version'>,
  names: Pick<KeyNames, 'of' | 'version'>,
): Prompts {
  return {
    for(device) {
      switch (device) {
        case 'gamepad':
          return gamepad(keys.profile());
        case 'touch':
          return touch();
        default:
          return keyboard(keys.profile(), (input) => names.of(input));
      }
    },
    version: () => keys.version() + names.version(),
  };
}

// None when they are the keys that choose a card, or on a touch screen.
export function endlessHint(
  prompts: DevicePrompts,
  night = false,
): { keys: readonly string[]; label: string }[] {
  const same = prompts.navigate.join() === prompts.navigateRow.join();
  return same ? [] : [{ keys: prompts.navigate, label: night ? t('la nuit') : t('sans fin') }];
}

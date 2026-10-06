import type { InputDevice } from '../input/intents';

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
  confirm: string;
  back: string;
  skill: string;
  controls: readonly Control[];
}

const KEYBOARD: DevicePrompts = {
  name: 'Clavier et souris',
  style: 'key',
  navigate: ['↑', '↓'],
  navigateRow: ['←', '→'],
  confirm: 'Entrée',
  back: 'Échap',
  skill: 'E',
  controls: [
    { action: 'Se déplacer', keys: ['ZQSD', 'WASD'] },
    { action: 'Viser', keys: ['Souris'] },
    { action: 'Tirer', keys: ['Clic gauche', 'Espace'] },
    { action: 'Choisir un piège', keys: ['Molette', '1 à 5'] },
    { action: 'Poser le piège', keys: ['Clic droit', 'F'] },
    { action: 'Compétence', keys: ['E'] },
    { action: 'Pause', keys: ['Échap'] },
  ],
};

const GAMEPAD: DevicePrompts = {
  name: 'Manette',
  style: 'button',
  navigate: ['Stick gauche', 'Croix'],
  navigateRow: ['Stick gauche', 'Croix'],
  confirm: 'A',
  back: 'B',
  skill: 'LT',
  controls: [
    { action: 'Se déplacer', keys: ['Stick gauche'] },
    { action: 'Viser', keys: ['Stick droit'] },
    { action: 'Tirer', keys: ['RT'] },
    { action: 'Choisir un piège', keys: ['LB', 'RB'] },
    { action: 'Poser le piège', keys: ['A'] },
    { action: 'Compétence', keys: ['LT'] },
    { action: 'Pause', keys: ['Start'] },
  ],
};

export function promptsFor(device: InputDevice): DevicePrompts {
  return device === 'gamepad' ? GAMEPAD : KEYBOARD;
}

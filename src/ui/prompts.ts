import type { InputDevice } from '../input/intents';

export type KeyStyle = 'key' | 'button';

export interface Control {
  action: string;
  keys: readonly string[];
}

export interface DevicePrompts {
  name: string;
  style: KeyStyle;
  navigate: readonly string[];
  confirm: string;
  back: string;
  skill: string;
  ultimate: string;
  controls: readonly Control[];
}

const KEYBOARD: DevicePrompts = {
  name: 'Clavier et souris',
  style: 'key',
  navigate: ['↑', '↓'],
  confirm: 'Entrée',
  back: 'Échap',
  skill: 'E',
  ultimate: 'R',
  controls: [
    { action: 'Se déplacer', keys: ['ZQSD', 'WASD'] },
    { action: 'Viser', keys: ['Souris'] },
    { action: 'Tirer', keys: ['Clic gauche', 'Espace'] },
    { action: 'Choisir un piège', keys: ['Molette', '1 à 5'] },
    { action: 'Poser le piège', keys: ['Clic droit', 'F'] },
    { action: 'Compétence', keys: ['E'] },
    { action: 'Ultime, au drop', keys: ['R'] },
    { action: 'Pause', keys: ['Échap'] },
  ],
};

const GAMEPAD: DevicePrompts = {
  name: 'Manette',
  style: 'button',
  navigate: ['Stick gauche', 'Croix'],
  confirm: 'A',
  back: 'B',
  skill: 'X',
  ultimate: 'Y',
  controls: [
    { action: 'Se déplacer', keys: ['Stick gauche'] },
    { action: 'Viser', keys: ['Stick droit'] },
    { action: 'Tirer', keys: ['RT'] },
    { action: 'Choisir un piège', keys: ['LB', 'RB'] },
    { action: 'Poser le piège', keys: ['A'] },
    { action: 'Compétence', keys: ['X'] },
    { action: 'Ultime, au drop', keys: ['Y'] },
    { action: 'Pause', keys: ['Start'] },
  ],
};

export function promptsFor(device: InputDevice): DevicePrompts {
  return device === 'gamepad' ? GAMEPAD : KEYBOARD;
}

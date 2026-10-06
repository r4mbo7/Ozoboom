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

// Menus are touched, not walked: a touch screen shows no key hints and no skill key.
const TOUCH: DevicePrompts = {
  name: 'Tactile',
  style: 'key',
  navigate: [],
  navigateRow: [],
  confirm: 'Toucher',
  back: 'Retour',
  skill: '',
  controls: [
    { action: 'Se déplacer', keys: ['Glisser sur l’arène'] },
    { action: 'Viser et tirer', keys: ['Automatique'] },
    { action: 'Poser un piège à ses pieds', keys: ['Toucher sa tuile'] },
    { action: 'Le poser ailleurs', keys: ['Glisser sa tuile'] },
    { action: 'Compétence', keys: ['Toucher sa tuile'] },
    { action: 'Pause', keys: ['❚❚'] },
  ],
};

export function promptsFor(device: InputDevice): DevicePrompts {
  switch (device) {
    case 'gamepad':
      return GAMEPAD;
    case 'touch':
      return TOUCH;
    default:
      return KEYBOARD;
  }
}

import { t } from '../shared/i18n';
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

const keyboard = (): DevicePrompts => ({
  name: t('Clavier et souris'),
  style: 'key',
  navigate: ['↑', '↓'],
  navigateRow: ['←', '→'],
  confirm: t('Entrée'),
  back: t('Échap'),
  skill: 'E',
  controls: [
    { action: t('Se déplacer'), keys: ['ZQSD', 'WASD'] },
    { action: t('Viser'), keys: [t('Souris')] },
    { action: t('Tirer'), keys: [t('Clic gauche'), t('Espace')] },
    { action: t('Choisir un piège'), keys: [t('Molette'), t('1 à 5')] },
    { action: t('Poser le piège'), keys: [t('Clic droit'), 'F'] },
    { action: t('Compétence'), keys: ['E'] },
    { action: t('Pause'), keys: [t('Échap')] },
  ],
});

const gamepad = (): DevicePrompts => ({
  name: t('Manette'),
  style: 'button',
  navigate: [t('Stick gauche'), t('Croix')],
  navigateRow: [t('Stick gauche'), t('Croix')],
  confirm: 'A',
  back: 'B',
  skill: 'LT',
  controls: [
    { action: t('Se déplacer'), keys: [t('Stick gauche')] },
    { action: t('Viser'), keys: [t('Stick droit')] },
    { action: t('Tirer'), keys: ['RT'] },
    { action: t('Choisir un piège'), keys: ['LB', 'RB'] },
    { action: t('Poser le piège'), keys: ['A'] },
    { action: t('Compétence'), keys: ['LT'] },
    { action: t('Pause'), keys: ['Start'] },
  ],
});

// Menus are touched, not walked: a touch screen shows no key hints and no skill key.
const touch = (): DevicePrompts => ({
  name: t('Tactile'),
  style: 'key',
  navigate: [],
  navigateRow: [],
  confirm: t('Toucher'),
  back: t('Retour'),
  skill: '',
  controls: [
    { action: t('Se déplacer'), keys: [t('Glisser sur l’arène')] },
    { action: t('Viser et tirer'), keys: [t('Automatique')] },
    { action: t('Poser un piège à ses pieds'), keys: [t('Toucher sa tuile')] },
    { action: t('Le poser ailleurs'), keys: [t('Glisser sa tuile')] },
    { action: t('Compétence'), keys: [t('Toucher sa tuile')] },
    { action: t('Pause'), keys: ['❚❚'] },
  ],
});

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
export function endlessHint(prompts: DevicePrompts): { keys: readonly string[]; label: string }[] {
  const same = prompts.navigate.join() === prompts.navigateRow.join();
  return same ? [] : [{ keys: prompts.navigate, label: t('sans fin') }];
}

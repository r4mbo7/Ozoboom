import { t } from '../shared/i18n';
import { mouseButtonOf } from './profile';

// Bindings hold the physical key: its name is the letter the player's own layout prints on it.
// The browser tells it where it can (the layout map, the key each code typed); elsewhere a French
// player is taken for an AZERTY keyboard until a key tells otherwise.
const learned = new Map<string, string>();
let azerty = false;
let version = 0;

// Bumped when a name changes, for the screens that show them.
export function keyNamesVersion(): number {
  return version;
}

const AZERTY_LETTERS: Readonly<Record<string, string>> = {
  KeyQ: 'A',
  KeyA: 'Q',
  KeyW: 'Z',
  KeyZ: 'W',
  Semicolon: 'M',
  KeyM: ',',
};

const PUNCTUATION: Readonly<Record<string, string>> = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  IntlBackslash: '<',
};

const NAMES: Readonly<Record<string, () => string>> = {
  Space: () => t('Espace'),
  ShiftLeft: () => t('Maj'),
  ShiftRight: () => t('Maj droite'),
  ControlLeft: () => t('Ctrl'),
  ControlRight: () => t('Ctrl droite'),
  AltLeft: () => t('Alt'),
  AltRight: () => t('Alt Gr'),
  Tab: () => 'Tab',
  Enter: () => t('Entrée'),
  NumpadEnter: () => t('Entrée'),
  CapsLock: () => t('Verr. maj'),
  Insert: () => t('Inser'),
  Home: () => t('Début'),
  End: () => t('Fin'),
  PageUp: () => t('Page ↑'),
  PageDown: () => t('Page ↓'),
  ArrowUp: () => '↑',
  ArrowDown: () => '↓',
  ArrowLeft: () => '←',
  ArrowRight: () => '→',
  WheelUp: () => t('Molette ↑'),
  WheelDown: () => t('Molette ↓'),
};

const MOUSE_NAMES: readonly (() => string)[] = [
  () => t('Clic gauche'),
  () => t('Clic molette'),
  () => t('Clic droit'),
];

export function learnKeyName(code: string, key: string): void {
  if (!(code.startsWith('Key') || code in PUNCTUATION) || key.length !== 1) {
    return;
  }
  const name = key.toUpperCase();
  if (learned.get(code) !== name) {
    learned.set(code, name);
    version += 1;
  }
}

export function guessKeyboardLayout(languages: readonly string[]): void {
  const first = languages[0]?.toLowerCase() ?? '';
  const guessed = first === 'fr' || first === 'fr-fr' || first === 'fr-be' || first === 'fr-lu';
  if (guessed !== azerty) {
    azerty = guessed;
    version += 1;
  }
}

interface LayoutKeyboard {
  getLayoutMap(): Promise<ReadonlyMap<string, string>>;
}

export async function learnKeyboardLayout(): Promise<void> {
  guessKeyboardLayout(navigator.languages);
  const keyboard = (navigator as { keyboard?: Partial<LayoutKeyboard> }).keyboard;
  if (keyboard?.getLayoutMap === undefined) {
    return;
  }
  try {
    const layout = await keyboard.getLayoutMap();
    for (const [code, key] of layout) {
      learnKeyName(code, key);
    }
  } catch (error) {
    // A frame of another origin is not allowed to read it.
    if (!(error instanceof DOMException)) {
      throw error;
    }
  }
}

export function inputName(input: string): string {
  const button = mouseButtonOf(input);
  if (button !== null) {
    return MOUSE_NAMES[button]?.() ?? t('Bouton {number}', { number: button + 1 });
  }
  const named = NAMES[input];
  if (named !== undefined) {
    return named();
  }
  const known = learned.get(input);
  if (known !== undefined) {
    return known;
  }
  const guessed = azerty ? AZERTY_LETTERS[input] : undefined;
  if (guessed !== undefined) {
    return guessed;
  }
  const letter = /^(?:Key|Digit)(.)$/.exec(input);
  if (letter?.[1] !== undefined) {
    return letter[1];
  }
  const pad = /^Numpad(\d)$/.exec(input);
  if (pad?.[1] !== undefined) {
    return t('Pavé {number}', { number: pad[1] });
  }
  return PUNCTUATION[input] ?? input;
}

const BUTTON_NAMES: readonly string[] = [
  'A',
  'B',
  'X',
  'Y',
  'LB',
  'RB',
  'LT',
  'RT',
  'View',
  'Start',
  'L3',
  'R3',
];

export function buttonName(button: number): string {
  return BUTTON_NAMES[button] ?? t('Bouton {number}', { number: button + 1 });
}

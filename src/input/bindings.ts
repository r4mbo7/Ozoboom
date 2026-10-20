import type { Emote } from '../sim/commands';

export type Control =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'fire'
  | 'placeTrap'
  | 'nextTrap'
  | 'previousTrap'
  | 'selectTrap1'
  | 'selectTrap2'
  | 'selectTrap3'
  | 'selectTrap4'
  | 'selectTrap5'
  | 'skill'
  | 'dash'
  | 'emoteUp'
  | 'emoteDown'
  | 'emoteLeft'
  | 'emoteRight'
  | 'pause'
  | 'menuUp'
  | 'menuDown'
  | 'menuLeft'
  | 'menuRight'
  | 'menuPrevious'
  | 'menuNext'
  | 'confirm'
  | 'back';

export const TRAP_SLOT_CONTROLS = [
  'selectTrap1',
  'selectTrap2',
  'selectTrap3',
  'selectTrap4',
  'selectTrap5',
] as const satisfies readonly Control[];

export type Bindings<K extends string | number> = Readonly<Partial<Record<K, readonly Control[]>>>;

// The keys that stay whatever the player chooses: the menus, the pause and the trap slots. Keys are
// KeyboardEvent.code, the physical position on a US layout: KeyW is the Z of an AZERTY keyboard.
export const FIXED_KEY_BINDINGS: Bindings<string> = {
  ArrowUp: ['menuUp'],
  ArrowLeft: ['menuLeft'],
  ArrowDown: ['menuDown'],
  ArrowRight: ['menuRight'],
  Tab: ['menuNext'],
  Digit1: ['selectTrap1'],
  Digit2: ['selectTrap2'],
  Digit3: ['selectTrap3'],
  Digit4: ['selectTrap4'],
  Digit5: ['selectTrap5'],
  Escape: ['pause', 'back'],
  Enter: ['confirm'],
  NumpadEnter: ['confirm'],
};

export const SHIFTED_KEY_BINDINGS: Bindings<string> = {
  Tab: ['previousTrap', 'menuPrevious'],
};

export const SHIFT_KEYS: readonly string[] = ['ShiftLeft', 'ShiftRight'];

export type Wheel = 'down' | 'up';

export interface Stick {
  readonly x: number;
  readonly y: number;
}

// What every input does, built from the player's key profile (`src/input/profile.ts`).
export interface InputBindings {
  readonly keys: Bindings<string>;
  readonly mouseButtons: Bindings<number>;
  readonly wheel: Readonly<Record<Wheel, readonly Control[]>>;
  readonly gamepadButtons: Bindings<number>;
  readonly sticks: { readonly move: Stick; readonly aim: Stick };
}

// Button indices of the "standard" Gamepad API mapping, named after the Xbox controller.
export const StandardButton = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  View: 8,
  Menu: 9,
  LeftStick: 10,
  RightStick: 11,
  DpadUp: 12,
  DpadDown: 13,
  DpadLeft: 14,
  DpadRight: 15,
  Guide: 16,
} as const;

// The buttons that stay whatever the player chooses: A and B validate and go back in the menus.
export const FIXED_GAMEPAD_BUTTON_BINDINGS: Bindings<number> = {
  [StandardButton.A]: ['confirm'],
  [StandardButton.B]: ['back'],
  [StandardButton.LB]: ['menuPrevious'],
  [StandardButton.RB]: ['menuNext'],
  [StandardButton.DpadUp]: ['menuUp', 'emoteUp'],
  [StandardButton.DpadDown]: ['menuDown', 'emoteDown'],
  [StandardButton.DpadLeft]: ['menuLeft', 'emoteLeft'],
  [StandardButton.DpadRight]: ['menuRight', 'emoteRight'],
  [StandardButton.Menu]: ['pause'],
};

// Axis indices of the "standard" mapping; y grows downwards, like screen coordinates.
export const LEFT_STICK: Stick = { x: 0, y: 1 };
export const RIGHT_STICK: Stick = { x: 2, y: 3 };

// In a game, each arrow of the directional pad makes the player's gesture of that side.
export const EMOTE_CONTROLS: Readonly<Record<Emote, Control>> = {
  sunrise: 'emoteUp',
  fireworks: 'emoteDown',
  heart: 'emoteLeft',
  arrow: 'emoteRight',
};

export const STICK_DEADZONE = 0.2;

export type MenuDirection = 'up' | 'down' | 'left' | 'right';

export const MENU_DIRECTION_CONTROLS: Readonly<Record<MenuDirection, Control>> = {
  up: 'menuUp',
  down: 'menuDown',
  left: 'menuLeft',
  right: 'menuRight',
};

// The moving stick walks the menus like the directional pad: a push past MENU_STICK_PRESS on its
// dominant axis is one press, held until the stick comes back under MENU_STICK_RELEASE.
export const MENU_STICK_PRESS = 0.6;
export const MENU_STICK_RELEASE = 0.3;
export const MENU_REPEAT_DELAY_MS = 400;
export const MENU_REPEAT_INTERVAL_MS = 120;

// The virtual stick is born under the thumb and follows it past its rim, in CSS pixels. A trap
// tile dragged further than TOUCH_DRAG_THRESHOLD is dropped where the finger leaves it.
export const TOUCH_STICK_RADIUS = 56;
export const TOUCH_DRAG_THRESHOLD = 16;

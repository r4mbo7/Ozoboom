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
  | 'pause'
  | 'menuUp'
  | 'menuDown'
  | 'menuLeft'
  | 'menuRight'
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

const up = ['moveUp', 'menuUp'] as const;
const down = ['moveDown', 'menuDown'] as const;
const left = ['moveLeft', 'menuLeft'] as const;
const right = ['moveRight', 'menuRight'] as const;

// Keys are KeyboardEvent.code, the physical position on a US layout: KeyW is the Z of an AZERTY
// keyboard, so ZQSD and WASD are the same physical keys whatever the system layout.
export const KEY_BINDINGS: Bindings<string> = {
  KeyW: up,
  KeyA: left,
  KeyS: down,
  KeyD: right,
  ArrowUp: up,
  ArrowLeft: left,
  ArrowDown: down,
  ArrowRight: right,
  Space: ['fire'],
  KeyF: ['placeTrap'],
  Tab: ['nextTrap'],
  Digit1: ['selectTrap1'],
  Digit2: ['selectTrap2'],
  Digit3: ['selectTrap3'],
  Digit4: ['selectTrap4'],
  Digit5: ['selectTrap5'],
  KeyE: ['skill'],
  Escape: ['pause', 'back'],
  Enter: ['confirm'],
  NumpadEnter: ['confirm'],
};

export const SHIFTED_KEY_BINDINGS: Bindings<string> = {
  Tab: ['previousTrap'],
};

export const SHIFT_KEYS: readonly string[] = ['ShiftLeft', 'ShiftRight'];

export const MOUSE_BUTTON_BINDINGS: Bindings<number> = {
  0: ['fire'],
  2: ['placeTrap'],
};

export const WHEEL_BINDINGS: Readonly<Record<'down' | 'up', readonly Control[]>> = {
  down: ['nextTrap'],
  up: ['previousTrap'],
};

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

export const GAMEPAD_BUTTON_BINDINGS: Bindings<number> = {
  [StandardButton.RT]: ['fire'],
  [StandardButton.A]: ['placeTrap', 'confirm'],
  [StandardButton.B]: ['back'],
  [StandardButton.LT]: ['skill'],
  [StandardButton.LB]: ['previousTrap'],
  [StandardButton.RB]: ['nextTrap'],
  [StandardButton.DpadUp]: ['menuUp'],
  [StandardButton.DpadDown]: ['menuDown'],
  [StandardButton.DpadLeft]: ['menuLeft'],
  [StandardButton.DpadRight]: ['menuRight'],
  [StandardButton.Menu]: ['pause'],
};

// Axis indices of the "standard" mapping; y grows downwards, like screen coordinates.
export const GAMEPAD_STICKS = {
  move: { x: 0, y: 1 },
  aim: { x: 2, y: 3 },
} as const;

export const STICK_DEADZONE = 0.2;

export type MenuDirection = 'up' | 'down' | 'left' | 'right';

export const MENU_DIRECTION_CONTROLS: Readonly<Record<MenuDirection, Control>> = {
  up: 'menuUp',
  down: 'menuDown',
  left: 'menuLeft',
  right: 'menuRight',
};

// The left stick walks the menus like the directional pad: a push past MENU_STICK_PRESS on its
// dominant axis is one press, held until the stick comes back under MENU_STICK_RELEASE.
export const MENU_STICK_PRESS = 0.6;
export const MENU_STICK_RELEASE = 0.3;
export const MENU_REPEAT_DELAY_MS = 400;
export const MENU_REPEAT_INTERVAL_MS = 120;

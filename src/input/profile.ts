import {
  FIXED_GAMEPAD_BUTTON_BINDINGS,
  FIXED_KEY_BINDINGS,
  LEFT_STICK,
  RIGHT_STICK,
  StandardButton,
  type Bindings,
  type Control,
  type InputBindings,
  type Wheel,
} from './bindings';

export const KEYBOARD_ACTIONS = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'fire',
  'placeTrap',
  'skill',
  'dash',
  'nextTrap',
  'previousTrap',
] as const satisfies readonly Control[];

export type KeyboardAction = (typeof KEYBOARD_ACTIONS)[number];

export const GAMEPAD_ACTIONS = [
  'fire',
  'placeTrap',
  'skill',
  'dash',
  'previousTrap',
  'nextTrap',
] as const satisfies readonly Control[];

export type GamepadAction = (typeof GAMEPAD_ACTIONS)[number];

export type Slot = 0 | 1;

// Two inputs per action, either of which may be empty.
export type Slots<T> = readonly [T | null, T | null];

// A key is its KeyboardEvent.code, a mouse button `Mouse` and its number, the wheel `WheelUp` and
// `WheelDown`; a gamepad button is its index in the standard mapping.
export interface KeyProfile {
  readonly keyboard: Readonly<Record<KeyboardAction, Slots<string>>>;
  readonly gamepad: Readonly<Record<GamepadAction, Slots<number>>>;
  // The right stick moves and the left one aims.
  readonly swapSticks: boolean;
}

export const DEFAULT_KEY_PROFILE: KeyProfile = {
  keyboard: {
    moveUp: ['KeyW', 'ArrowUp'],
    moveDown: ['KeyS', 'ArrowDown'],
    moveLeft: ['KeyA', 'ArrowLeft'],
    moveRight: ['KeyD', 'ArrowRight'],
    fire: ['Mouse0', 'Space'],
    placeTrap: ['Mouse2', 'KeyF'],
    skill: ['KeyE', null],
    dash: ['ShiftLeft', 'ShiftRight'],
    nextTrap: ['WheelDown', 'Tab'],
    previousTrap: ['WheelUp', null],
  },
  gamepad: {
    fire: [StandardButton.RT, null],
    placeTrap: [StandardButton.A, null],
    skill: [StandardButton.LT, null],
    dash: [StandardButton.B, null],
    previousTrap: [StandardButton.LB, null],
    nextTrap: [StandardButton.RB, null],
  },
  swapSticks: false,
};

// The keys that move also walk the menus, beside the arrows.
const MENU_OF_MOVE: Partial<Record<KeyboardAction, Control>> = {
  moveUp: 'menuUp',
  moveDown: 'menuDown',
  moveLeft: 'menuLeft',
  moveRight: 'menuRight',
};

const WHEELS: Readonly<Record<string, Wheel>> = { WheelUp: 'up', WheelDown: 'down' };

export function mouseButtonOf(input: string): number | null {
  const match = /^Mouse(\d)$/.exec(input);
  return match === null ? null : Number(match[1]);
}

export function wheelOf(input: string): Wheel | null {
  return WHEELS[input] ?? null;
}

// Escape pauses, the digits pick a trap, Backspace and Delete empty a slot while it listens; the
// system keys and the function keys belong to the browser.
const RESERVED_KEYS: ReadonlySet<string> = new Set([
  'Escape',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Backspace',
  'Delete',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
  'ContextMenu',
]);

export function isReservedKey(input: string): boolean {
  return RESERVED_KEYS.has(input) || /^F\d+$/.test(input);
}

// Start pauses, the directional pad walks the menus and makes the gestures.
const BINDABLE_BUTTONS: ReadonlySet<number> = new Set([
  StandardButton.A,
  StandardButton.B,
  StandardButton.X,
  StandardButton.Y,
  StandardButton.LB,
  StandardButton.RB,
  StandardButton.LT,
  StandardButton.RT,
  StandardButton.View,
  StandardButton.LeftStick,
  StandardButton.RightStick,
]);

export function isBindableButton(button: number): boolean {
  return BINDABLE_BUTTONS.has(button);
}

export function compileBindings(profile: KeyProfile): InputBindings {
  const keys: Partial<Record<string, Control[]>> = {};
  const mouseButtons: Partial<Record<number, Control[]>> = {};
  const wheel: Record<Wheel, Control[]> = { up: [], down: [] };
  for (const action of KEYBOARD_ACTIONS) {
    const menu = MENU_OF_MOVE[action];
    const controls: readonly Control[] = menu === undefined ? [action] : [action, menu];
    for (const input of profile.keyboard[action]) {
      if (input === null) {
        continue;
      }
      const button = mouseButtonOf(input);
      const side = wheelOf(input);
      if (button !== null) {
        add(mouseButtons, button, controls);
      } else if (side !== null) {
        wheel[side] = merged(wheel[side], controls);
      } else {
        add(keys, input, controls);
      }
    }
  }
  addAll(keys, FIXED_KEY_BINDINGS);
  const gamepadButtons: Partial<Record<number, Control[]>> = {};
  for (const action of GAMEPAD_ACTIONS) {
    for (const button of profile.gamepad[action]) {
      if (button !== null) {
        add(gamepadButtons, button, [action]);
      }
    }
  }
  addAll(gamepadButtons, FIXED_GAMEPAD_BUTTON_BINDINGS);
  return {
    keys,
    mouseButtons,
    wheel,
    gamepadButtons,
    sticks: profile.swapSticks
      ? { move: RIGHT_STICK, aim: LEFT_STICK }
      : { move: LEFT_STICK, aim: RIGHT_STICK },
  };
}

export const DEFAULT_INPUT_BINDINGS: InputBindings = compileBindings(DEFAULT_KEY_PROFILE);

export interface Rebound<A extends string> {
  readonly profile: KeyProfile;
  // The slot that held the input before, which takes the one it replaced.
  readonly moved: { readonly action: A; readonly slot: Slot } | null;
}

export function rebindKey(
  profile: KeyProfile,
  action: KeyboardAction,
  slot: Slot,
  input: string | null,
): Rebound<KeyboardAction> {
  const { table, moved } = rebind(profile.keyboard, KEYBOARD_ACTIONS, action, slot, input);
  return { profile: { ...profile, keyboard: table }, moved };
}

export function rebindButton(
  profile: KeyProfile,
  action: GamepadAction,
  slot: Slot,
  button: number | null,
): Rebound<GamepadAction> {
  const { table, moved } = rebind(profile.gamepad, GAMEPAD_ACTIONS, action, slot, button);
  return { profile: { ...profile, gamepad: table }, moved };
}

function rebind<A extends string, T>(
  table: Readonly<Record<A, Slots<T>>>,
  actions: readonly A[],
  action: A,
  slot: Slot,
  input: T | null,
): { table: Record<A, Slots<T>>; moved: { action: A; slot: Slot } | null } {
  const replaced = table[action][slot];
  let moved: { action: A; slot: Slot } | null = null;
  const next = {} as Record<A, Slots<T>>;
  for (const other of actions) {
    const [first, second] = table[other];
    const slotValue = (own: Slot, value: T | null): T | null => {
      if (other === action && own === slot) {
        return input;
      }
      if (input !== null && value === input) {
        moved = { action: other, slot: own };
        return replaced;
      }
      return value;
    };
    next[other] = [slotValue(0, first), slotValue(1, second)];
  }
  return { table: next, moved };
}

// A stored profile from an older version keeps what it can: an action it does not know, or does
// not hold right, takes its default.
export function parseKeyProfile(text: string | null): KeyProfile | null {
  if (text === null) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
  if (!isRecord(value)) {
    return null;
  }
  return {
    keyboard: readSlots(
      value.keyboard,
      KEYBOARD_ACTIONS,
      DEFAULT_KEY_PROFILE.keyboard,
      (input): input is string => typeof input === 'string' && !isReservedKey(input),
    ),
    gamepad: readSlots(
      value.gamepad,
      GAMEPAD_ACTIONS,
      DEFAULT_KEY_PROFILE.gamepad,
      (input): input is number => typeof input === 'number' && isBindableButton(input),
    ),
    swapSticks: value.swapSticks === true,
  };
}

function readSlots<A extends string, T>(
  value: unknown,
  actions: readonly A[],
  defaults: Readonly<Record<A, Slots<T>>>,
  valid: (input: unknown) => input is T,
): Record<A, Slots<T>> {
  const table = {} as Record<A, Slots<T>>;
  for (const action of actions) {
    const slots = isRecord(value) ? value[action] : undefined;
    const read = (input: unknown): T | null | undefined =>
      input === null ? null : valid(input) ? input : undefined;
    const first = Array.isArray(slots) ? read(slots[0]) : undefined;
    const second = Array.isArray(slots) ? read(slots[1]) : undefined;
    table[action] =
      first === undefined || second === undefined ? defaults[action] : [first, second];
  }
  return table;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addAll<K extends string | number>(
  table: Partial<Record<K, Control[]>>,
  bindings: Bindings<K>,
): void {
  for (const [key, controls] of Object.entries(bindings) as [K, readonly Control[]][]) {
    add(table, key, controls);
  }
}

function add<K extends string | number>(
  table: Partial<Record<K, Control[]>>,
  key: K,
  controls: readonly Control[],
): void {
  table[key] = merged(table[key] ?? [], controls);
}

function merged(current: readonly Control[], controls: readonly Control[]): Control[] {
  return [...current, ...controls.filter((control) => !current.includes(control))];
}

// The profile the devices play with: the game sets it from the player's preferences, and every
// change bumps the version, for the screens that show its keys.
let current = DEFAULT_KEY_PROFILE;
let bindings = DEFAULT_INPUT_BINDINGS;
let version = 0;

export function keyProfile(): KeyProfile {
  return current;
}

export function inputBindings(): InputBindings {
  return bindings;
}

export function keyProfileVersion(): number {
  return version;
}

export function setKeyProfile(profile: KeyProfile): void {
  current = profile;
  bindings = compileBindings(profile);
  version += 1;
}

import { describe, expect, it } from 'vitest';
import { GAMEPAD_BUTTON_BINDINGS, KEY_BINDINGS, StandardButton } from './bindings';
import { fakeGamepad } from './fakes';
import { INITIAL_GAMEPAD_STATE, reduceGamepad } from './gamepad';
import type { GameplayIntents, InputDevice, InputSnapshot, MenuIntents } from './intents';
import {
  INITIAL_KEYBOARD_MOUSE_STATE,
  reduceKeyboard,
  reducePointer,
  takeKeyboardMouseFrame,
  type KeyboardMouseState,
  type PointerEventLike,
} from './keyboard-mouse';
import { INITIAL_MERGE_STATE, mergeFrames } from './merge';

interface Expected {
  readonly gameplay?: Partial<GameplayIntents>;
  readonly menu?: Partial<MenuIntents>;
  readonly pointerScreen?: { x: number; y: number };
}

const IDLE_GAMEPLAY: GameplayIntents = {
  move: { x: 0, y: 0 },
  aim: { x: 1, y: 0 },
  fire: false,
  skill: false,
  ultimate: false,
  placeTrap: false,
  nextTrap: false,
  previousTrap: false,
  selectTrap: null,
  pause: false,
};

const IDLE_MENU: MenuIntents = {
  up: false,
  down: false,
  left: false,
  right: false,
  confirm: false,
  back: false,
};

function expectedSnapshot(device: InputDevice, expected: Expected): InputSnapshot {
  return {
    device,
    gameplay: { ...IDLE_GAMEPLAY, ...expected.gameplay },
    menu: { ...IDLE_MENU, ...expected.menu },
    pointerScreen: expected.pointerScreen ?? null,
    aimFromPointer: false,
  };
}

function snapshotFromKeyboardMouse(state: KeyboardMouseState): InputSnapshot {
  return mergeFrames(
    INITIAL_MERGE_STATE,
    takeKeyboardMouseFrame(state).frame,
    reduceGamepad(INITIAL_GAMEPAD_STATE, []).frame,
    0,
  ).snapshot;
}

function snapshotFromGamepad(pad: ReturnType<typeof fakeGamepad>): InputSnapshot {
  return mergeFrames(
    INITIAL_MERGE_STATE,
    takeKeyboardMouseFrame(INITIAL_KEYBOARD_MOUSE_STATE).frame,
    reduceGamepad(INITIAL_GAMEPAD_STATE, [pad]).frame,
    0,
  ).snapshot;
}

function pressKeys(...codes: string[]): KeyboardMouseState {
  return codes.reduce(
    (state, code) => reduceKeyboard(state, { type: 'keydown', code }),
    INITIAL_KEYBOARD_MOUSE_STATE,
  );
}

const keyboardCases: readonly (readonly [string, Expected])[] = [
  ['KeyW', { gameplay: { move: { x: 0, y: -1 } }, menu: { up: true } }],
  ['KeyA', { gameplay: { move: { x: -1, y: 0 } }, menu: { left: true } }],
  ['KeyS', { gameplay: { move: { x: 0, y: 1 } }, menu: { down: true } }],
  ['KeyD', { gameplay: { move: { x: 1, y: 0 } }, menu: { right: true } }],
  ['ArrowUp', { gameplay: { move: { x: 0, y: -1 } }, menu: { up: true } }],
  ['ArrowLeft', { gameplay: { move: { x: -1, y: 0 } }, menu: { left: true } }],
  ['ArrowDown', { gameplay: { move: { x: 0, y: 1 } }, menu: { down: true } }],
  ['ArrowRight', { gameplay: { move: { x: 1, y: 0 } }, menu: { right: true } }],
  ['Space', { gameplay: { fire: true } }],
  ['KeyF', { gameplay: { placeTrap: true } }],
  ['Tab', { gameplay: { nextTrap: true } }],
  ['Digit1', { gameplay: { selectTrap: 0 } }],
  ['Digit2', { gameplay: { selectTrap: 1 } }],
  ['Digit3', { gameplay: { selectTrap: 2 } }],
  ['Digit4', { gameplay: { selectTrap: 3 } }],
  ['Digit5', { gameplay: { selectTrap: 4 } }],
  ['KeyE', { gameplay: { skill: true } }],
  ['KeyR', { gameplay: { ultimate: true } }],
  ['Escape', { gameplay: { pause: true }, menu: { back: true } }],
  ['Enter', { menu: { confirm: true } }],
  ['NumpadEnter', { menu: { confirm: true } }],
];

const pointerCases: readonly (readonly [string, PointerEventLike, Expected])[] = [
  [
    'left click',
    { type: 'down', button: 0, x: 10, y: 20 },
    { gameplay: { fire: true }, pointerScreen: { x: 10, y: 20 } },
  ],
  [
    'right click',
    { type: 'down', button: 2, x: 10, y: 20 },
    { gameplay: { placeTrap: true }, pointerScreen: { x: 10, y: 20 } },
  ],
  ['wheel down', { type: 'wheel', deltaY: 100 }, { gameplay: { nextTrap: true } }],
  ['wheel up', { type: 'wheel', deltaY: -100 }, { gameplay: { previousTrap: true } }],
];

const gamepadCases: readonly (readonly [keyof typeof StandardButton, Expected])[] = [
  ['RT', { gameplay: { fire: true } }],
  ['A', { gameplay: { placeTrap: true }, menu: { confirm: true } }],
  ['B', { menu: { back: true } }],
  ['X', { gameplay: { skill: true } }],
  ['Y', { gameplay: { ultimate: true } }],
  ['LB', { gameplay: { previousTrap: true } }],
  ['RB', { gameplay: { nextTrap: true } }],
  ['DpadUp', { menu: { up: true } }],
  ['DpadDown', { menu: { down: true } }],
  ['DpadLeft', { menu: { left: true } }],
  ['DpadRight', { menu: { right: true } }],
  ['Menu', { gameplay: { pause: true } }],
];

describe('keyboard bindings', () => {
  it.each(keyboardCases)('%s produces its intents', (code, expected) => {
    const state = pressKeys(code);

    const snapshot = snapshotFromKeyboardMouse(state);

    expect(snapshot).toEqual(expectedSnapshot('keyboardMouse', expected));
  });

  it('Shift+Tab selects the previous trap', () => {
    const state = pressKeys('ShiftLeft', 'Tab');

    const snapshot = snapshotFromKeyboardMouse(state);

    expect(snapshot).toEqual(
      expectedSnapshot('keyboardMouse', { gameplay: { previousTrap: true } }),
    );
  });

  it('covers every key of the binding table', () => {
    const tested = keyboardCases.map(([code]) => code).sort();

    expect(tested).toEqual(Object.keys(KEY_BINDINGS).sort());
  });
});

describe('mouse bindings', () => {
  it.each(pointerCases)('%s produces its intents', (_, event, expected) => {
    const state = reducePointer(INITIAL_KEYBOARD_MOUSE_STATE, event);

    const snapshot = snapshotFromKeyboardMouse(state);

    expect(snapshot).toEqual(expectedSnapshot('keyboardMouse', expected));
  });
});

describe('gamepad bindings', () => {
  it.each(gamepadCases)('%s produces its intents', (button, expected) => {
    const pad = fakeGamepad({ pressed: [StandardButton[button]] });

    const snapshot = snapshotFromGamepad(pad);

    expect(snapshot).toEqual(expectedSnapshot('gamepad', expected));
  });

  it('covers every button of the binding table', () => {
    const tested = gamepadCases.map(([button]) => String(StandardButton[button])).sort();

    expect(tested).toEqual(Object.keys(GAMEPAD_BUTTON_BINDINGS).sort());
  });

  it('moves with the left stick', () => {
    const pad = fakeGamepad({ axes: [1, 0, 0, 0] });

    const snapshot = snapshotFromGamepad(pad);

    expect(snapshot).toEqual(expectedSnapshot('gamepad', { gameplay: { move: { x: 1, y: 0 } } }));
  });

  it('aims with the right stick', () => {
    const pad = fakeGamepad({ axes: [0, 0, 0, 0.7] });

    const snapshot = snapshotFromGamepad(pad);

    expect(snapshot).toEqual(expectedSnapshot('gamepad', { gameplay: { aim: { x: 0, y: 1 } } }));
  });
});

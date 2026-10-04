import { describe, expect, it } from 'vitest';
import {
  INITIAL_KEYBOARD_MOUSE_STATE,
  reduceKeyboard,
  reducePointer,
  releaseAll,
  takeKeyboardMouseFrame,
  type KeyboardMouseState,
} from './keyboard-mouse';

const keydown = (state: KeyboardMouseState, code: string) =>
  reduceKeyboard(state, { type: 'keydown', code });
const keyup = (state: KeyboardMouseState, code: string) =>
  reduceKeyboard(state, { type: 'keyup', code });

describe('reduceKeyboard', () => {
  it('records one press per physical key press, ignoring auto-repeat', () => {
    const state = keydown(keydown(keydown(INITIAL_KEYBOARD_MOUSE_STATE, 'KeyF'), 'KeyF'), 'KeyF');

    const { frame } = takeKeyboardMouseFrame(state);

    expect(frame.presses).toEqual(['placeTrap']);
    expect(frame.held).toEqual(new Set(['placeTrap']));
  });

  it('releases a key on keyup', () => {
    const state = keyup(keydown(INITIAL_KEYBOARD_MOUSE_STATE, 'Space'), 'Space');

    const { frame } = takeKeyboardMouseFrame(state);

    expect(frame.held).toEqual(new Set());
    expect(frame.active).toBe(true);
  });

  it('ignores a keyup for a key that was not down', () => {
    const state = keyup(INITIAL_KEYBOARD_MOUSE_STATE, 'Space');

    expect(state).toBe(INITIAL_KEYBOARD_MOUSE_STATE);
  });

  it('counts an unbound key as activity', () => {
    const state = keydown(INITIAL_KEYBOARD_MOUSE_STATE, 'KeyP');

    const { frame } = takeKeyboardMouseFrame(state);

    expect(frame).toMatchObject({ presses: [], active: true });
  });

  it('normalizes a diagonal and cancels opposite directions', () => {
    const diagonal = keydown(keydown(INITIAL_KEYBOARD_MOUSE_STATE, 'KeyW'), 'ArrowRight');
    const opposite = keydown(keydown(INITIAL_KEYBOARD_MOUSE_STATE, 'KeyA'), 'KeyD');

    const diagonalMove = takeKeyboardMouseFrame(diagonal).frame.move;
    const oppositeMove = takeKeyboardMouseFrame(opposite).frame.move;

    expect(diagonalMove.x).toBeCloseTo(Math.SQRT1_2, 10);
    expect(diagonalMove.y).toBeCloseTo(-Math.SQRT1_2, 10);
    expect(oppositeMove).toEqual({ x: 0, y: 0 });
  });
});

describe('reducePointer', () => {
  it('tracks the pointer and flags its movement', () => {
    const state = reducePointer(INITIAL_KEYBOARD_MOUSE_STATE, { type: 'move', x: 40, y: 30 });

    const { frame } = takeKeyboardMouseFrame(state);

    expect(frame).toMatchObject({ pointer: { x: 40, y: 30 }, pointerMoved: true, active: true });
  });

  it('holds a mouse button until it is released', () => {
    const down = reducePointer(INITIAL_KEYBOARD_MOUSE_STATE, {
      type: 'down',
      button: 0,
      x: 1,
      y: 2,
    });
    const up = reducePointer(down, { type: 'up', button: 0 });

    expect(takeKeyboardMouseFrame(down).frame.held).toEqual(new Set(['fire']));
    expect(takeKeyboardMouseFrame(up).frame.held).toEqual(new Set());
  });

  it('ignores a horizontal-only wheel event', () => {
    const state = reducePointer(INITIAL_KEYBOARD_MOUSE_STATE, { type: 'wheel', deltaY: 0 });

    expect(state).toBe(INITIAL_KEYBOARD_MOUSE_STATE);
  });

  it('records each wheel notch', () => {
    const once = reducePointer(INITIAL_KEYBOARD_MOUSE_STATE, { type: 'wheel', deltaY: 100 });
    const twice = reducePointer(once, { type: 'wheel', deltaY: -100 });

    expect(takeKeyboardMouseFrame(twice).frame.presses).toEqual(['nextTrap', 'previousTrap']);
  });
});

describe('releaseAll', () => {
  it('drops held keys and buttons when the window loses focus', () => {
    const held = reducePointer(keydown(INITIAL_KEYBOARD_MOUSE_STATE, 'KeyW'), {
      type: 'down',
      button: 0,
      x: 0,
      y: 0,
    });

    const { frame } = takeKeyboardMouseFrame(releaseAll(held));

    expect(frame.held).toEqual(new Set());
    expect(frame.move).toEqual({ x: 0, y: 0 });
  });
});

describe('takeKeyboardMouseFrame', () => {
  it('consumes presses and movement flags but keeps held keys and the pointer', () => {
    const state = reducePointer(keydown(INITIAL_KEYBOARD_MOUSE_STATE, 'KeyE'), {
      type: 'move',
      x: 5,
      y: 6,
    });

    const next = takeKeyboardMouseFrame(takeKeyboardMouseFrame(state).state).frame;

    expect(next).toMatchObject({
      presses: [],
      pointer: { x: 5, y: 6 },
      pointerMoved: false,
      active: false,
    });
    expect(next.held).toEqual(new Set(['skill']));
  });
});

import type { Vec2 } from '../sim/state';
import {
  KEY_BINDINGS,
  MOUSE_BUTTON_BINDINGS,
  SHIFTED_KEY_BINDINGS,
  SHIFT_KEYS,
  WHEEL_BINDINGS,
  type Control,
} from './bindings';
import { clampLength, type KeyboardMouseFrame } from './merge';

export interface KeyboardMouseState {
  readonly keys: ReadonlySet<string>;
  readonly buttons: ReadonlySet<number>;
  readonly presses: readonly Control[];
  readonly pointer: Vec2 | null;
  readonly pointerMoved: boolean;
  readonly active: boolean;
}

export interface KeyEventLike {
  readonly type: 'keydown' | 'keyup';
  readonly code: string;
}

export type PointerEventLike =
  | { readonly type: 'move'; readonly x: number; readonly y: number }
  | { readonly type: 'down'; readonly button: number; readonly x: number; readonly y: number }
  | { readonly type: 'up'; readonly button: number }
  | { readonly type: 'wheel'; readonly deltaY: number };

export const INITIAL_KEYBOARD_MOUSE_STATE: KeyboardMouseState = {
  keys: new Set(),
  buttons: new Set(),
  presses: [],
  pointer: null,
  pointerMoved: false,
  active: false,
};

export function reduceKeyboard(state: KeyboardMouseState, event: KeyEventLike): KeyboardMouseState {
  if (event.type === 'keyup') {
    if (!state.keys.has(event.code)) return state;
    return { ...state, keys: without(state.keys, event.code), active: true };
  }
  if (state.keys.has(event.code)) return state;
  return {
    ...state,
    keys: new Set(state.keys).add(event.code),
    presses: [...state.presses, ...keyControls(event.code, isShiftHeld(state.keys))],
    active: true,
  };
}

export function reducePointer(
  state: KeyboardMouseState,
  event: PointerEventLike,
): KeyboardMouseState {
  switch (event.type) {
    case 'move':
      return { ...state, pointer: { x: event.x, y: event.y }, pointerMoved: true, active: true };
    case 'down':
      if (state.buttons.has(event.button)) return state;
      return {
        ...state,
        buttons: new Set(state.buttons).add(event.button),
        presses: [...state.presses, ...(MOUSE_BUTTON_BINDINGS[event.button] ?? [])],
        pointer: { x: event.x, y: event.y },
        active: true,
      };
    case 'up':
      if (!state.buttons.has(event.button)) return state;
      return { ...state, buttons: without(state.buttons, event.button), active: true };
    case 'wheel':
      if (event.deltaY === 0) return state;
      return {
        ...state,
        presses: [...state.presses, ...WHEEL_BINDINGS[event.deltaY > 0 ? 'down' : 'up']],
        active: true,
      };
  }
}

export function releaseAll(state: KeyboardMouseState): KeyboardMouseState {
  return { ...state, keys: new Set(), buttons: new Set() };
}

export function takeKeyboardMouseFrame(state: KeyboardMouseState): {
  frame: KeyboardMouseFrame;
  state: KeyboardMouseState;
} {
  const shift = isShiftHeld(state.keys);
  const held = new Set<Control>();
  for (const code of state.keys) for (const control of keyControls(code, shift)) held.add(control);
  for (const button of state.buttons) {
    for (const control of MOUSE_BUTTON_BINDINGS[button] ?? []) held.add(control);
  }
  const axis = (negative: Control, positive: Control) =>
    (held.has(positive) ? 1 : 0) - (held.has(negative) ? 1 : 0);
  return {
    frame: {
      held,
      presses: state.presses,
      move: clampLength(axis('moveLeft', 'moveRight'), axis('moveUp', 'moveDown')),
      aim: null,
      active: state.active,
      pointer: state.pointer,
      pointerMoved: state.pointerMoved,
    },
    state: { ...state, presses: [], pointerMoved: false, active: false },
  };
}

export interface KeyboardMouseAdapter {
  take(): KeyboardMouseFrame;
  destroy(): void;
}

const KEYS_WITH_BROWSER_DEFAULT: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Tab',
]);

export function attachKeyboardMouse(target: HTMLElement): KeyboardMouseAdapter {
  const view = target.ownerDocument.defaultView;
  if (view === null) throw new Error('Input target is not attached to a window');
  let state = INITIAL_KEYBOARD_MOUSE_STATE;
  const local = (event: MouseEvent) => {
    const rect = target.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditable(event.target)) return;
    if (KEYS_WITH_BROWSER_DEFAULT.has(event.code)) event.preventDefault();
    state = reduceKeyboard(state, { type: 'keydown', code: event.code });
  };
  const onKeyUp = (event: KeyboardEvent) => {
    state = reduceKeyboard(state, { type: 'keyup', code: event.code });
  };
  const onBlur = () => {
    state = releaseAll(state);
  };
  const onMouseMove = (event: MouseEvent) => {
    state = reducePointer(state, { type: 'move', ...local(event) });
  };
  const onMouseDown = (event: MouseEvent) => {
    state = reducePointer(state, { type: 'down', button: event.button, ...local(event) });
  };
  const onMouseUp = (event: MouseEvent) => {
    state = reducePointer(state, { type: 'up', button: event.button });
  };
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    state = reducePointer(state, { type: 'wheel', deltaY: event.deltaY });
  };
  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  view.addEventListener('keydown', onKeyDown);
  view.addEventListener('keyup', onKeyUp);
  view.addEventListener('blur', onBlur);
  view.addEventListener('mouseup', onMouseUp);
  target.addEventListener('mousemove', onMouseMove);
  target.addEventListener('mousedown', onMouseDown);
  target.addEventListener('wheel', onWheel, { passive: false });
  target.addEventListener('contextmenu', onContextMenu);

  return {
    take() {
      const taken = takeKeyboardMouseFrame(state);
      state = taken.state;
      return taken.frame;
    },
    destroy() {
      view.removeEventListener('keydown', onKeyDown);
      view.removeEventListener('keyup', onKeyUp);
      view.removeEventListener('blur', onBlur);
      view.removeEventListener('mouseup', onMouseUp);
      target.removeEventListener('mousemove', onMouseMove);
      target.removeEventListener('mousedown', onMouseDown);
      target.removeEventListener('wheel', onWheel);
      target.removeEventListener('contextmenu', onContextMenu);
    },
  };
}

function keyControls(code: string, shift: boolean): readonly Control[] {
  return (shift ? SHIFTED_KEY_BINDINGS[code] : undefined) ?? KEY_BINDINGS[code] ?? [];
}

function isShiftHeld(keys: ReadonlySet<string>): boolean {
  return SHIFT_KEYS.some((code) => keys.has(code));
}

function without<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  next.delete(value);
  return next;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

import type { Vec2 } from '../sim/state';
import { IDLE_INPUT } from '../sim/commands';
import {
  MENU_DIRECTION_CONTROLS,
  MENU_REPEAT_DELAY_MS,
  MENU_REPEAT_INTERVAL_MS,
  TRAP_SLOT_CONTROLS,
  type Control,
  type MenuDirection,
} from './bindings';
import type { InputDevice, InputSnapshot, MenuIntents } from './intents';

export interface DeviceFrame {
  readonly held: ReadonlySet<Control>;
  readonly presses: readonly Control[];
  readonly move: Vec2;
  readonly aim: Vec2 | null;
  readonly active: boolean;
}

export interface KeyboardMouseFrame extends DeviceFrame {
  readonly pointer: Vec2 | null;
  readonly pointerMoved: boolean;
}

export interface GamepadFrame extends DeviceFrame {
  readonly disconnected: boolean;
}

// `drop`: where on the screen a trap dragged from the HUD left the finger this frame.
export interface TouchFrame extends DeviceFrame {
  readonly drop: Vec2 | null;
}

export const IDLE_TOUCH_FRAME: TouchFrame = {
  held: new Set(),
  presses: [],
  move: IDLE_INPUT.move,
  aim: null,
  active: false,
  drop: null,
};

export interface MergeState {
  readonly device: InputDevice;
  readonly aim: Vec2;
  readonly aimFromPointer: boolean;
  readonly nextRepeatAt: Readonly<Record<MenuDirection, number | null>>;
}

export const INITIAL_MERGE_STATE: MergeState = {
  device: 'none',
  aim: IDLE_INPUT.aim,
  aimFromPointer: false,
  nextRepeatAt: { up: null, down: null, left: null, right: null },
};

export function mergeFrames(
  state: MergeState,
  keyboardMouse: KeyboardMouseFrame,
  gamepad: GamepadFrame,
  now: number,
  touch: TouchFrame = IDLE_TOUCH_FRAME,
): { snapshot: InputSnapshot; state: MergeState } {
  const frames = [keyboardMouse, gamepad, touch];
  const held = (control: Control) => frames.some((frame) => frame.held.has(control));
  const pressed = (control: Control) => frames.some((frame) => frame.presses.includes(control));

  const device = nextDevice(state.device, keyboardMouse, gamepad, touch);
  const aim = gamepad.aim ?? state.aim;
  const stickAimed = gamepad.aim !== null && gamepad.active;
  const aimFromPointer =
    keyboardMouse.pointerMoved || (state.aimFromPointer && !stickAimed && !touch.active);

  const nextRepeatAt = { ...state.nextRepeatAt };
  const repeat = (direction: MenuDirection) => {
    const control = MENU_DIRECTION_CONTROLS[direction];
    const step = stepRepeat(state.nextRepeatAt[direction], pressed(control), held(control), now);
    nextRepeatAt[direction] = step.nextAt;
    return step.fire;
  };
  const menu: MenuIntents = {
    up: repeat('up'),
    down: repeat('down'),
    left: repeat('left'),
    right: repeat('right'),
    confirm: pressed('confirm'),
    back: pressed('back'),
  };

  return {
    snapshot: {
      device,
      gameplay: {
        move: clampLength(
          keyboardMouse.move.x + gamepad.move.x + touch.move.x,
          keyboardMouse.move.y + gamepad.move.y + touch.move.y,
        ),
        aim,
        fire: held('fire'),
        skill: held('skill'),
        placeTrap: pressed('placeTrap'),
        nextTrap: pressed('nextTrap'),
        previousTrap: pressed('previousTrap'),
        selectTrap: selectedTrap(keyboardMouse.presses, gamepad.presses, touch.presses),
        pause: pressed('pause'),
      },
      menu,
      // A finger has no pointer to aim with: it only points where it drops a trap.
      pointerScreen: touch.active ? touch.drop : keyboardMouse.pointer,
      aimFromPointer,
    },
    state: { device, aim, aimFromPointer, nextRepeatAt },
  };
}

function nextDevice(
  current: InputDevice,
  keyboardMouse: KeyboardMouseFrame,
  gamepad: GamepadFrame,
  touch: TouchFrame,
): InputDevice {
  if (gamepad.active) return 'gamepad';
  if (keyboardMouse.active) return 'keyboardMouse';
  if (touch.active) return 'touch';
  if (gamepad.disconnected && current === 'gamepad') return 'none';
  return current;
}

function stepRepeat(
  nextAt: number | null,
  pressed: boolean,
  held: boolean,
  now: number,
): { fire: boolean; nextAt: number | null } {
  if (pressed) return { fire: true, nextAt: now + MENU_REPEAT_DELAY_MS };
  if (!held || nextAt === null) return { fire: false, nextAt: null };
  if (now < nextAt) return { fire: false, nextAt };
  const following = nextAt + MENU_REPEAT_INTERVAL_MS;
  return { fire: true, nextAt: following > now ? following : now + MENU_REPEAT_INTERVAL_MS };
}

function selectedTrap(...pressLists: readonly (readonly Control[])[]): number | null {
  let slot: number | null = null;
  for (const presses of pressLists) {
    for (const control of presses) {
      const index = TRAP_SLOT_CONTROLS.findIndex((slotControl) => slotControl === control);
      if (index !== -1) slot = index;
    }
  }
  return slot;
}

export function clampLength(x: number, y: number): Vec2 {
  const length = Math.sqrt(x * x + y * y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

import { clamp01 } from '../shared/scalar';
import type { Vec2 } from '../sim/state';
import {
  MENU_DIRECTION_CONTROLS,
  MENU_STICK_PRESS,
  MENU_STICK_RELEASE,
  STICK_DEADZONE,
  type Control,
  type InputBindings,
  type MenuDirection,
} from './bindings';
import type { GamepadFrame } from './merge';
import { DEFAULT_INPUT_BINDINGS } from './profile';

export interface GamepadButtonLike {
  readonly pressed: boolean;
  readonly value: number;
}

export interface GamepadLike {
  readonly index: number;
  readonly id: string;
  readonly mapping: string;
  readonly connected: boolean;
  readonly axes: readonly number[];
  readonly buttons: readonly GamepadButtonLike[];
  readonly vibrationActuator?: Pick<GamepadHapticActuator, 'playEffect'> | null;
}

export interface GamepadState {
  readonly index: number | null;
  readonly move: Vec2;
  readonly aim: Vec2;
  // For each connected pad, which of its buttons, then its move and aim sticks, are in use, and
  // where its move stick points the menus: a pad given the view back keeps what it held.
  readonly controls: ReadonlyMap<number, readonly boolean[]>;
  readonly menuDirections: ReadonlyMap<number, MenuDirection | null>;
}

const ZERO: Vec2 = { x: 0, y: 0 };

export const INITIAL_GAMEPAD_STATE: GamepadState = {
  index: null,
  move: ZERO,
  aim: ZERO,
  controls: new Map(),
  menuDirections: new Map(),
};

export function applyRadialDeadzone(x: number, y: number, deadzone = STICK_DEADZONE): Vec2 {
  const length = Math.sqrt(x * x + y * y);
  if (length <= deadzone) return ZERO;
  const scaled = Math.min(1, (length - deadzone) / (1 - deadzone));
  return { x: (x / length) * scaled, y: (y / length) * scaled };
}

function readStick(pad: GamepadLike, { x, y }: { x: number; y: number }): Vec2 {
  return applyRadialDeadzone(pad.axes[x] ?? 0, pad.axes[y] ?? 0);
}

function controlsInUse(pad: GamepadLike, sticks: InputBindings['sticks']): boolean[] {
  return [
    ...pad.buttons.map((button) => button.pressed),
    ...[sticks.move, sticks.aim].map((axes) => !sameVec(readStick(pad, axes), ZERO)),
  ];
}

// An idle pad listed first, such as a headset dongle or a virtual pad, must not hide the one in use.
function selectGamepad(
  connected: readonly GamepadLike[],
  controls: ReadonlyMap<number, readonly boolean[]>,
  state: GamepadState,
): GamepadLike | null {
  const selected = connected.find((pad) => pad.index === state.index);
  const starting = connected.filter((pad) => {
    const before = state.controls.get(pad.index) ?? [];
    return (controls.get(pad.index) ?? []).some((on, control) => on && before[control] !== true);
  });
  if (selected !== undefined && starting.includes(selected)) return selected;
  return starting[0] ?? selected ?? connected[0] ?? null;
}

export function reduceGamepad(
  state: GamepadState,
  pads: readonly (GamepadLike | null)[],
  bindings: InputBindings = DEFAULT_INPUT_BINDINGS,
): { frame: GamepadFrame; state: GamepadState } {
  const connected = pads.filter((pad): pad is GamepadLike => pad?.connected === true);
  const controls = new Map(
    connected.map((pad) => [pad.index, controlsInUse(pad, bindings.sticks)] as const),
  );
  const pad = selectGamepad(connected, controls, state);
  if (pad === null) {
    return {
      frame: {
        held: new Set(),
        presses: [],
        move: ZERO,
        aim: null,
        active: false,
        disconnected: state.index !== null,
      },
      state: INITIAL_GAMEPAD_STATE,
    };
  }

  const previousButtons = state.controls.get(pad.index)?.slice(0, pad.buttons.length) ?? [];
  const buttons = pad.buttons.map((button) => button.pressed);
  const held = new Set<Control>();
  const presses: Control[] = [];
  buttons.forEach((down, index) => {
    if (!down) return;
    const controls = bindings.gamepadButtons[index] ?? [];
    for (const control of controls) held.add(control);
    if (previousButtons[index] !== true) presses.push(...controls);
  });
  const { sticks } = bindings;
  const menuDirections = new Map(
    connected.map(
      ({ index, axes }) =>
        [
          index,
          stickMenuDirection(
            axes[sticks.move.x] ?? 0,
            axes[sticks.move.y] ?? 0,
            state.menuDirections.get(index) ?? null,
          ),
        ] as const,
    ),
  );
  const previousDirection = state.menuDirections.get(pad.index) ?? null;
  const menuDirection = menuDirections.get(pad.index) ?? null;
  if (menuDirection !== null) {
    const control = MENU_DIRECTION_CONTROLS[menuDirection];
    held.add(control);
    if (menuDirection !== previousDirection) presses.push(control);
  }
  const anyButtonPressed = buttons.some((down, index) => down && previousButtons[index] !== true);

  const move = readStick(pad, sticks.move);
  const aimStick = readStick(pad, sticks.aim);
  const aimLength = Math.sqrt(aimStick.x * aimStick.x + aimStick.y * aimStick.y);
  const sticksMoved = !sameVec(move, state.move) || !sameVec(aimStick, state.aim);

  return {
    frame: {
      held,
      presses,
      move,
      aim: aimLength > 0 ? { x: aimStick.x / aimLength, y: aimStick.y / aimLength } : null,
      active: anyButtonPressed || sticksMoved,
      disconnected: state.index !== null && !connected.some(({ index }) => index === state.index),
    },
    state: { index: pad.index, move, aim: aimStick, controls, menuDirections },
  };
}

function stickMenuDirection(
  x: number,
  y: number,
  current: MenuDirection | null,
): MenuDirection | null {
  if (current !== null && reach(current, x, y) >= MENU_STICK_RELEASE) return current;
  const direction: MenuDirection =
    Math.abs(x) >= Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
  return reach(direction, x, y) >= MENU_STICK_PRESS ? direction : null;
}

function reach(direction: MenuDirection, x: number, y: number): number {
  switch (direction) {
    case 'up':
      return -y;
    case 'down':
      return y;
    case 'left':
      return -x;
    case 'right':
      return x;
  }
}

// The Gamepad API only exists in secure contexts.
export function navigatorGamepads(): readonly (GamepadLike | null)[] {
  return 'getGamepads' in navigator ? navigator.getGamepads() : [];
}

export function rumbleGamepad(pad: GamepadLike | null, strength: number, durationMs: number): void {
  const actuator = pad?.vibrationActuator;
  if (!actuator) return;
  const magnitude = clamp01(strength);
  void actuator.playEffect('dual-rumble', {
    duration: durationMs,
    strongMagnitude: magnitude,
    weakMagnitude: magnitude,
  });
}

function sameVec(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}

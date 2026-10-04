import type { Vec2 } from '../sim/state';
import { GAMEPAD_BUTTON_BINDINGS, GAMEPAD_STICKS, STICK_DEADZONE, type Control } from './bindings';
import type { GamepadFrame } from './merge';

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
  readonly buttons: readonly boolean[];
  readonly move: Vec2;
  readonly aim: Vec2;
}

const ZERO: Vec2 = { x: 0, y: 0 };

export const INITIAL_GAMEPAD_STATE: GamepadState = {
  index: null,
  buttons: [],
  move: ZERO,
  aim: ZERO,
};

export function applyRadialDeadzone(x: number, y: number, deadzone = STICK_DEADZONE): Vec2 {
  const length = Math.sqrt(x * x + y * y);
  if (length <= deadzone) return ZERO;
  const scaled = Math.min(1, (length - deadzone) / (1 - deadzone));
  return { x: (x / length) * scaled, y: (y / length) * scaled };
}

export function selectGamepad(
  pads: readonly (GamepadLike | null)[],
  currentIndex: number | null,
): GamepadLike | null {
  const connected = pads.filter((pad): pad is GamepadLike => pad?.connected === true);
  return connected.find((pad) => pad.index === currentIndex) ?? connected[0] ?? null;
}

export function reduceGamepad(
  state: GamepadState,
  pads: readonly (GamepadLike | null)[],
): { frame: GamepadFrame; state: GamepadState } {
  const pad = selectGamepad(pads, state.index);
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

  const previousButtons = pad.index === state.index ? state.buttons : [];
  const buttons = pad.buttons.map((button) => button.pressed);
  const held = new Set<Control>();
  const presses: Control[] = [];
  buttons.forEach((down, index) => {
    if (!down) return;
    const controls = GAMEPAD_BUTTON_BINDINGS[index] ?? [];
    for (const control of controls) held.add(control);
    if (previousButtons[index] !== true) presses.push(...controls);
  });
  const anyButtonPressed = buttons.some((down, index) => down && previousButtons[index] !== true);

  const stick = ({ x, y }: { x: number; y: number }) =>
    applyRadialDeadzone(pad.axes[x] ?? 0, pad.axes[y] ?? 0);
  const move = stick(GAMEPAD_STICKS.move);
  const aimStick = stick(GAMEPAD_STICKS.aim);
  const aimLength = Math.sqrt(aimStick.x * aimStick.x + aimStick.y * aimStick.y);
  const sticksMoved = !sameVec(move, state.move) || !sameVec(aimStick, state.aim);

  return {
    frame: {
      held,
      presses,
      move,
      aim: aimLength > 0 ? { x: aimStick.x / aimLength, y: aimStick.y / aimLength } : null,
      active: anyButtonPressed || sticksMoved,
      disconnected: state.index !== null && pad.index !== state.index,
    },
    state: { index: pad.index, buttons, move, aim: aimStick },
  };
}

// The Gamepad API only exists in secure contexts.
export function navigatorGamepads(): readonly (GamepadLike | null)[] {
  return 'getGamepads' in navigator ? navigator.getGamepads() : [];
}

export function rumbleGamepad(pad: GamepadLike | null, strength: number, durationMs: number): void {
  const actuator = pad?.vibrationActuator;
  if (!actuator) return;
  const magnitude = Math.min(1, Math.max(0, strength));
  void actuator.playEffect('dual-rumble', {
    duration: durationMs,
    strongMagnitude: magnitude,
    weakMagnitude: magnitude,
  });
}

function sameVec(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}

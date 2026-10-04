import type { GamepadLike } from './gamepad';

export interface FakeGamepadOptions {
  readonly index?: number;
  readonly connected?: boolean;
  readonly pressed?: readonly number[];
  readonly axes?: readonly number[];
  readonly vibrationActuator?: GamepadLike['vibrationActuator'];
}

export function fakeGamepad(options: FakeGamepadOptions = {}): GamepadLike {
  const pressed = new Set(options.pressed ?? []);
  return {
    index: options.index ?? 0,
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
    mapping: 'standard',
    connected: options.connected ?? true,
    axes: options.axes ?? [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, index) => ({
      pressed: pressed.has(index),
      value: pressed.has(index) ? 1 : 0,
    })),
    vibrationActuator: options.vibrationActuator ?? null,
  };
}

import type { PlayerInput } from '../sim/commands';
import type { Vec2 } from '../sim/state';

export type InputDevice = 'keyboardMouse' | 'gamepad' | 'touch' | 'none';

export interface GameplayIntents extends PlayerInput {
  placeTrap: boolean;
  nextTrap: boolean;
  previousTrap: boolean;
  selectTrap: number | null;
  pause: boolean;
}

export interface MenuIntents {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
}

export interface InputSnapshot {
  device: InputDevice;
  gameplay: GameplayIntents;
  menu: MenuIntents;
  pointerScreen: Vec2 | null;
  aimFromPointer: boolean;
}

export interface InputSource {
  poll(): InputSnapshot;
  rumble(strength: number, durationMs: number): void;
  destroy(): void;
}

export type DeviceId = 'keyboardMouse' | `gamepad:${number}`;

export interface InputHub {
  poll(): ReadonlyMap<DeviceId, InputSnapshot>;
  rumble(device: DeviceId, strength: number, durationMs: number): void;
  destroy(): void;
}

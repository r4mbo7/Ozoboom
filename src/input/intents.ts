import type { Emote, PlayerInput } from '../sim/commands';
import type { Vec2 } from '../sim/state';

export type InputDevice = 'keyboardMouse' | 'gamepad' | 'touch' | 'none';

export interface GameplayIntents extends PlayerInput {
  placeTrap: boolean;
  dash: boolean;
  emote: Emote | null;
  pause: boolean;
}

export interface MenuIntents {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  // The tab before or after, on a screen with tabs: LB and RB, Q and E, Shift+Tab and Tab.
  previous: boolean;
  next: boolean;
  confirm: boolean;
  back: boolean;
}

export interface InputSnapshot {
  device: InputDevice;
  gameplay: GameplayIntents;
  menu: MenuIntents;
  // A or Entrée still down: menu.confirm is only the poll it went down on.
  confirmHeld: boolean;
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
  // The merged view of the last poll(), every device as one: for the title and solo.
  merged(): InputSnapshot;
  rumble(device: DeviceId, strength: number, durationMs: number): void;
  destroy(): void;
}

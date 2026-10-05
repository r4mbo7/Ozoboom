import { IDLE_INPUT } from '../sim/commands';
import {
  INITIAL_GAMEPAD_STATE,
  navigatorGamepads,
  reduceGamepad,
  rumbleGamepad,
  type GamepadLike,
  type GamepadState,
} from './gamepad';
import type { DeviceId, InputHub, InputSnapshot } from './intents';
import { attachKeyboardMouse } from './keyboard-mouse';
import {
  INITIAL_MERGE_STATE,
  mergeFrames,
  type GamepadFrame,
  type KeyboardMouseFrame,
  type MergeState,
} from './merge';

interface PadState {
  readonly gamepad: GamepadState;
  readonly merge: MergeState;
}

export interface HubState {
  readonly keyboardMouse: MergeState;
  readonly pads: ReadonlyMap<number, PadState>;
  readonly merged: PadState;
}

export const INITIAL_HUB_STATE: HubState = {
  keyboardMouse: INITIAL_MERGE_STATE,
  pads: new Map(),
  merged: { gamepad: INITIAL_GAMEPAD_STATE, merge: INITIAL_MERGE_STATE },
};

const IDLE_GAMEPAD_FRAME: GamepadFrame = {
  held: new Set(),
  presses: [],
  move: IDLE_INPUT.move,
  aim: null,
  active: false,
  disconnected: false,
};

const IDLE_KEYBOARD_MOUSE_FRAME: KeyboardMouseFrame = {
  held: new Set(),
  presses: [],
  move: IDLE_INPUT.move,
  aim: null,
  active: false,
  pointer: null,
  pointerMoved: false,
};

export function gamepadDeviceId(index: number): DeviceId {
  return `gamepad:${String(index)}` as DeviceId;
}

function gamepadIndex(device: DeviceId): number | null {
  return device === 'keyboardMouse' ? null : Number(device.slice('gamepad:'.length));
}

export function stepHub(
  state: HubState,
  keyboardMouse: KeyboardMouseFrame,
  pads: readonly (GamepadLike | null)[],
  now: number,
): {
  snapshots: ReadonlyMap<DeviceId, InputSnapshot>;
  merged: InputSnapshot;
  state: HubState;
} {
  const snapshots = new Map<DeviceId, InputSnapshot>();

  const keyboard = mergeFrames(state.keyboardMouse, keyboardMouse, IDLE_GAMEPAD_FRAME, now);
  snapshots.set('keyboardMouse', { ...keyboard.snapshot, device: 'keyboardMouse' });

  const nextPads = new Map<number, PadState>();
  for (const pad of pads) {
    if (pad?.connected !== true) continue;
    const previous = state.pads.get(pad.index);
    const reduced = reduceGamepad(previous?.gamepad ?? INITIAL_GAMEPAD_STATE, [pad]);
    const merged = mergeFrames(
      previous?.merge ?? INITIAL_MERGE_STATE,
      IDLE_KEYBOARD_MOUSE_FRAME,
      reduced.frame,
      now,
    );
    nextPads.set(pad.index, { gamepad: reduced.state, merge: merged.state });
    snapshots.set(gamepadDeviceId(pad.index), { ...merged.snapshot, device: 'gamepad' });
  }

  const mergedGamepad = reduceGamepad(state.merged.gamepad, pads);
  const merged = mergeFrames(state.merged.merge, keyboardMouse, mergedGamepad.frame, now);

  return {
    snapshots,
    merged: merged.snapshot,
    state: {
      keyboardMouse: keyboard.state,
      pads: nextPads,
      merged: { gamepad: mergedGamepad.state, merge: merged.state },
    },
  };
}

export function createInputHub(target: HTMLElement): InputHub {
  const keyboardMouse = attachKeyboardMouse(target);
  let state = INITIAL_HUB_STATE;
  let merged = mergeFrames(
    INITIAL_MERGE_STATE,
    IDLE_KEYBOARD_MOUSE_FRAME,
    IDLE_GAMEPAD_FRAME,
    0,
  ).snapshot;

  return {
    poll() {
      const stepped = stepHub(state, keyboardMouse.take(), navigatorGamepads(), performance.now());
      state = stepped.state;
      merged = stepped.merged;
      return stepped.snapshots;
    },
    merged() {
      return merged;
    },
    rumble(device, strength, durationMs) {
      const index = gamepadIndex(device);
      if (index === null) return;
      const pad = navigatorGamepads().find((candidate) => candidate?.index === index) ?? null;
      rumbleGamepad(pad?.connected === true ? pad : null, strength, durationMs);
    },
    destroy() {
      keyboardMouse.destroy();
    },
  };
}

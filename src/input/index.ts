import {
  INITIAL_GAMEPAD_STATE,
  navigatorGamepads,
  reduceGamepad,
  rumbleGamepad,
  selectGamepad,
} from './gamepad';
import type { InputSource } from './intents';
import { attachKeyboardMouse } from './keyboard-mouse';
import { INITIAL_MERGE_STATE, mergeFrames } from './merge';

export function createInputSource(target: HTMLElement): InputSource {
  const keyboardMouse = attachKeyboardMouse(target);
  let gamepadState = INITIAL_GAMEPAD_STATE;
  let mergeState = INITIAL_MERGE_STATE;

  return {
    poll() {
      const gamepad = reduceGamepad(gamepadState, navigatorGamepads());
      gamepadState = gamepad.state;
      const merged = mergeFrames(
        mergeState,
        keyboardMouse.take(),
        gamepad.frame,
        performance.now(),
      );
      mergeState = merged.state;
      return merged.snapshot;
    },
    rumble(strength, durationMs) {
      rumbleGamepad(selectGamepad(navigatorGamepads(), gamepadState.index), strength, durationMs);
    },
    destroy() {
      keyboardMouse.destroy();
    },
  };
}

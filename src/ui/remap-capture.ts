import type { GamepadLike } from '../input/gamepad';
import type { KeyNames } from '../input/key-names';
import { isBindableButton, isReservedKey } from '../input/profile';
import type { Tab } from './remap-model';

const START_BUTTON = 9;

const CAPTURE = { capture: true };

export interface Heard {
  cancel(): void;
  key(input: string | null): void;
  button(number: number): void;
  refused(what: 'key' | 'button'): void;
}

export interface SlotCapture {
  readPads(pads: readonly (GamepadLike | null)[]): void;
  stop(): void;
}

export type CaptureTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export function startCapture(
  target: CaptureTarget,
  names: Pick<KeyNames, 'learn'>,
  tab: Tab,
  heard: Heard,
): SlotCapture {
  // null before the first read: a button counts as it goes down, never one held since the slot was chosen.
  let held: ReadonlySet<string> | null = null;

  function onKeyDown(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) {
      return;
    }
    if (event.code === 'Escape') {
      heard.cancel();
    } else if (tab !== 'keyboard') {
      return;
    } else if (event.code === 'Backspace' || event.code === 'Delete') {
      heard.key(null);
    } else if (isReservedKey(event.code)) {
      heard.refused('key');
    } else {
      if (!(event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)) {
        names.learn(event.code, event.key);
      }
      heard.key(event.code);
    }
  }

  function onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopImmediatePropagation();
    swallowClicks(target);
    if (tab === 'keyboard') {
      heard.key(`Mouse${String(event.button)}`);
    } else {
      heard.cancel();
    }
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (tab !== 'keyboard' || event.deltaY === 0) {
      return;
    }
    heard.key(event.deltaY > 0 ? 'WheelDown' : 'WheelUp');
  }

  target.addEventListener('keydown', onKeyDown, CAPTURE);
  target.addEventListener('mousedown', onMouseDown, CAPTURE);
  target.addEventListener('wheel', onWheel, { capture: true, passive: false });
  return {
    readPads(pads) {
      const down = pressedButtons(pads);
      const before = held;
      held = down;
      const pressed = before === null ? undefined : [...down].find((id) => !before.has(id));
      if (pressed === undefined || tab !== 'gamepad') {
        return;
      }
      const number = Number(pressed.split(':')[1]);
      if (number === START_BUTTON) {
        heard.cancel();
      } else if (isBindableButton(number)) {
        heard.button(number);
      } else {
        heard.refused('button');
      }
    },
    stop() {
      target.removeEventListener('keydown', onKeyDown, CAPTURE);
      target.removeEventListener('mousedown', onMouseDown, CAPTURE);
      target.removeEventListener('wheel', onWheel, CAPTURE);
    },
  };
}

function pressedButtons(pads: readonly (GamepadLike | null)[]): Set<string> {
  const down = new Set<string>();
  for (const pad of pads) {
    if (pad?.connected !== true) {
      continue;
    }
    pad.buttons.forEach((state, number) => {
      if (state.pressed) {
        down.add(`${String(pad.index)}:${String(number)}`);
      }
    });
  }
  return down;
}

// The click after the press would choose a slot again: it comes with the release, and goes no further.
function swallowClicks(target: CaptureTarget): void {
  const kinds = ['click', 'auxclick', 'contextmenu'] as const;
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const kind of kinds) {
    target.addEventListener(kind, swallow, CAPTURE);
  }
  target.addEventListener(
    'mouseup',
    () => {
      setTimeout(() => {
        for (const kind of kinds) {
          target.removeEventListener(kind, swallow, CAPTURE);
        }
      }, 0);
    },
    { capture: true, once: true },
  );
}

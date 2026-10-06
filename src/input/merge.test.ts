import { describe, expect, it } from 'vitest';
import { StandardButton } from './bindings';
import { fakeGamepad } from './fakes';
import { INITIAL_GAMEPAD_STATE, reduceGamepad, type GamepadLike } from './gamepad';
import type { InputSnapshot } from './intents';
import {
  INITIAL_KEYBOARD_MOUSE_STATE,
  reduceKeyboard,
  reducePointer,
  takeKeyboardMouseFrame,
  type KeyEventLike,
  type PointerEventLike,
} from './keyboard-mouse';
import { INITIAL_MERGE_STATE, mergeFrames } from './merge';
import { INITIAL_TOUCH_STATE, reduceTouch, takeTouchFrame, type TouchEventLike } from './touch';

function createHarness() {
  let keyboardMouse = INITIAL_KEYBOARD_MOUSE_STATE;
  let gamepad = INITIAL_GAMEPAD_STATE;
  let merge = INITIAL_MERGE_STATE;
  let pads: (GamepadLike | null)[] = [];
  let touch = INITIAL_TOUCH_STATE;
  return {
    touch(event: TouchEventLike) {
      touch = reduceTouch(touch, event);
    },
    key(type: KeyEventLike['type'], code: string) {
      keyboardMouse = reduceKeyboard(keyboardMouse, { type, code });
    },
    pointer(event: PointerEventLike) {
      keyboardMouse = reducePointer(keyboardMouse, event);
    },
    plug(...next: (GamepadLike | null)[]) {
      pads = next;
    },
    poll(now = 0): InputSnapshot {
      const taken = takeKeyboardMouseFrame(keyboardMouse);
      keyboardMouse = taken.state;
      const reduced = reduceGamepad(gamepad, pads);
      gamepad = reduced.state;
      const touched = takeTouchFrame(touch);
      touch = touched.state;
      const merged = mergeFrames(merge, taken.frame, reduced.frame, now, touched.frame);
      merge = merged.state;
      return merged.snapshot;
    },
  };
}

describe('discrete intents', () => {
  it('last a single poll while the key stays down', () => {
    const input = createHarness();
    input.key('keydown', 'KeyF');

    const first = input.poll();
    const second = input.poll();

    expect(first.gameplay.placeTrap).toBe(true);
    expect(second.gameplay.placeTrap).toBe(false);
  });

  it('are not lost when the key is tapped between two polls', () => {
    const input = createHarness();
    input.key('keydown', 'Escape');
    input.key('keyup', 'Escape');

    const snapshot = input.poll();

    expect(snapshot.gameplay.pause).toBe(true);
    expect(snapshot.menu.back).toBe(true);
  });

  it('last a single poll while a gamepad button stays down', () => {
    const input = createHarness();
    input.plug(fakeGamepad({ pressed: [StandardButton.A] }));

    const first = input.poll();
    const second = input.poll();

    expect(first.menu.confirm).toBe(true);
    expect(second.menu.confirm).toBe(false);
  });

  it('select the last trap slot pressed during the poll', () => {
    const input = createHarness();
    input.key('keydown', 'Digit2');
    input.key('keydown', 'Digit4');

    expect(input.poll().gameplay.selectTrap).toBe(3);
    expect(input.poll().gameplay.selectTrap).toBeNull();
  });
});

describe('continuous intents', () => {
  it('stay true while held on either device', () => {
    const input = createHarness();
    input.key('keydown', 'Space');
    input.plug(fakeGamepad({ pressed: [StandardButton.LT] }));

    const first = input.poll();
    const second = input.poll();
    input.key('keyup', 'Space');
    input.plug(fakeGamepad());
    const released = input.poll();

    expect(first.gameplay).toMatchObject({ fire: true, skill: true });
    expect(second.gameplay).toMatchObject({ fire: true, skill: true });
    expect(released.gameplay).toMatchObject({ fire: false, skill: false });
  });

  it('add keyboard and stick movement, capped to a unit length', () => {
    const input = createHarness();
    input.key('keydown', 'KeyD');
    input.plug(fakeGamepad({ axes: [0, 1, 0, 0] }));

    const { move } = input.poll().gameplay;

    expect(move.x).toBeCloseTo(Math.SQRT1_2, 10);
    expect(move.y).toBeCloseTo(Math.SQRT1_2, 10);
  });
});

describe('menu repeat', () => {
  it('repeats after 400 ms then every 120 ms while held', () => {
    const input = createHarness();
    input.key('keydown', 'ArrowDown');

    const fired = [0, 16, 399, 400, 519, 520, 639, 640, 700].map(
      (now) => [now, input.poll(now).menu.down] as const,
    );

    expect(fired).toEqual([
      [0, true],
      [16, false],
      [399, false],
      [400, true],
      [519, false],
      [520, true],
      [639, false],
      [640, true],
      [700, false],
    ]);
  });

  it('starts over on release and press', () => {
    const input = createHarness();
    input.key('keydown', 'KeyS');
    input.poll(0);
    input.key('keyup', 'KeyS');
    input.poll(100);
    input.key('keydown', 'KeyS');

    expect(input.poll(450).menu.down).toBe(true);
    expect(input.poll(800).menu.down).toBe(false);
    expect(input.poll(850).menu.down).toBe(true);
  });

  it('does not burst after a long stall', () => {
    const input = createHarness();
    input.key('keydown', 'ArrowUp');
    input.poll(0);

    expect(input.poll(5000).menu.up).toBe(true);
    expect(input.poll(5016).menu.up).toBe(false);
    expect(input.poll(5120).menu.up).toBe(true);
  });

  it('repeats the gamepad directional pad', () => {
    const input = createHarness();
    input.plug(fakeGamepad({ pressed: [StandardButton.DpadLeft] }));

    expect(input.poll(0).menu.left).toBe(true);
    expect(input.poll(200).menu.left).toBe(false);
    expect(input.poll(400).menu.left).toBe(true);
  });

  it('never repeats confirm and back', () => {
    const input = createHarness();
    input.key('keydown', 'Enter');
    input.plug(fakeGamepad({ pressed: [StandardButton.B] }));
    input.poll(0);

    expect(input.poll(1000).menu).toMatchObject({ confirm: false, back: false });
  });
});

describe('menu left stick', () => {
  const tilt = (x: number, y: number) => fakeGamepad({ axes: [x, y, 0, 0] });

  it('moves the selection once the stick is pushed past 0.6', () => {
    const input = createHarness();
    input.plug(tilt(0.55, 0));
    const soft = input.poll(0).menu.right;
    input.plug(tilt(0.6, 0));
    const firm = input.poll(16).menu.right;

    expect([soft, firm]).toEqual([false, true]);
  });

  it('counts a new push only after the stick comes back under 0.3', () => {
    const input = createHarness();
    const pushes = [1, 0.4, 1, 0.25, 0.8].map((x, poll) => {
      input.plug(tilt(x, 0));
      return input.poll(poll * 16).menu.right;
    });

    expect(pushes).toEqual([true, false, false, false, true]);
  });

  it('repeats after 400 ms then every 120 ms while held, like the directional pad', () => {
    const input = createHarness();
    input.plug(tilt(0, 1));

    const fired = [0, 16, 399, 400, 519, 520].map((now) => input.poll(now).menu.down);

    expect(fired).toEqual([true, false, false, true, false, true]);
  });

  it('keeps repeating while the stick stays past 0.3', () => {
    const input = createHarness();
    input.plug(tilt(0, -1));
    input.poll(0);
    input.plug(tilt(0, -0.35));

    expect(input.poll(400).menu.up).toBe(true);
  });

  it('follows the dominant direction only, never a diagonal', () => {
    const input = createHarness();
    input.plug(tilt(0.7, -0.65));
    const mostlyRight = input.poll(0).menu;
    input.plug(tilt(0, 0));
    input.poll(16);
    input.plug(tilt(-0.5, 0.8));
    const mostlyDown = input.poll(32).menu;

    expect(mostlyRight).toMatchObject({ up: false, down: false, left: false, right: true });
    expect(mostlyDown).toMatchObject({ up: false, down: true, left: false, right: false });
  });

  it('turns to a new direction when rolled along the rim, once the first one is released', () => {
    const input = createHarness();
    input.plug(tilt(1, 0));
    input.poll(0);
    input.plug(tilt(0.5, 0.86));
    const halfway = input.poll(16).menu;
    input.plug(tilt(0.25, 0.97));
    const past = input.poll(32).menu;

    expect(halfway).toMatchObject({ down: false, right: false });
    expect(past).toMatchObject({ down: true, right: false });
  });

  it('ignores the right stick', () => {
    const input = createHarness();
    input.plug(fakeGamepad({ axes: [0, 0, 1, 1] }));

    expect(input.poll(0).menu).toMatchObject({ up: false, down: false, left: false, right: false });
  });
});

describe('device detection', () => {
  it('starts with no device', () => {
    expect(createHarness().poll().device).toBe('none');
  });

  it('follows the last device that produced an input', () => {
    const input = createHarness();
    input.key('keydown', 'KeyW');
    const keyboard = input.poll().device;
    input.plug(fakeGamepad({ pressed: [StandardButton.A] }));
    const gamepad = input.poll().device;
    const gamepadStillHeld = input.poll().device;
    input.pointer({ type: 'move', x: 1, y: 1 });
    const mouse = input.poll().device;

    expect([keyboard, gamepad, gamepadStillHeld, mouse]).toEqual([
      'keyboardMouse',
      'gamepad',
      'gamepad',
      'keyboardMouse',
    ]);
  });

  it('does not switch to a gamepad whose sticks rest in the dead zone', () => {
    const input = createHarness();
    input.key('keydown', 'KeyW');
    input.poll();
    input.plug(fakeGamepad({ axes: [0.1, -0.12, 0.05, 0.15] }));

    expect(input.poll().device).toBe('keyboardMouse');
  });

  it('falls back to no device when the active gamepad is unplugged', () => {
    const input = createHarness();
    input.plug(fakeGamepad({ pressed: [StandardButton.A] }));
    input.poll();
    input.plug(null);

    expect(input.poll().device).toBe('none');
  });

  it('keeps the keyboard when an idle gamepad is unplugged', () => {
    const input = createHarness();
    input.plug(fakeGamepad());
    input.poll();
    input.key('keydown', 'KeyW');
    input.poll();
    input.plug();

    expect(input.poll().device).toBe('keyboardMouse');
  });
});

describe('aim', () => {
  it('comes from the pointer after the mouse moves, keeping the last stick aim', () => {
    const input = createHarness();
    input.pointer({ type: 'move', x: 300, y: 200 });

    const snapshot = input.poll();

    expect(snapshot).toMatchObject({
      aimFromPointer: true,
      pointerScreen: { x: 300, y: 200 },
      gameplay: { aim: { x: 1, y: 0 } },
    });
  });

  it('comes from the right stick once it moves, and is kept when the stick rests', () => {
    const input = createHarness();
    input.pointer({ type: 'move', x: 300, y: 200 });
    input.poll();
    input.plug(fakeGamepad({ axes: [0, 0, -0.5, 0] }));
    const aiming = input.poll();
    input.plug(fakeGamepad());
    const resting = input.poll();

    expect(aiming).toMatchObject({ aimFromPointer: false, gameplay: { aim: { x: -1, y: 0 } } });
    expect(resting).toMatchObject({ aimFromPointer: false, gameplay: { aim: { x: -1, y: 0 } } });
  });

  it('stays on the pointer while the right stick is held still', () => {
    const input = createHarness();
    input.plug(fakeGamepad({ axes: [0, 0, 0, 1] }));
    input.poll();
    input.pointer({ type: 'move', x: 1, y: 1 });
    input.poll();

    expect(input.poll().aimFromPointer).toBe(true);
  });
});

describe('a touch screen', () => {
  it('becomes the device and steers the player with its stick', () => {
    const input = createHarness();
    input.touch({ type: 'down', id: 1, control: 'stick', x: 100, y: 100 });
    input.touch({ type: 'move', id: 1, x: 100, y: 300, onArena: true });

    const snapshot = input.poll();

    expect(snapshot.device).toBe('touch');
    expect(snapshot.gameplay.move).toEqual({ x: 0, y: 1 });
  });

  it('points at the spot of a dropped trap, and not with the mouse', () => {
    const input = createHarness();
    input.pointer({ type: 'move', x: 5, y: 5 });
    input.poll();
    input.touch({ type: 'down', id: 1, control: 'trap:1', x: 10, y: 400 });
    input.touch({ type: 'up', id: 1, x: 200, y: 150, onArena: true });

    const snapshot = input.poll();

    expect(snapshot.gameplay).toMatchObject({ selectTrap: 1, placeTrap: true });
    expect(snapshot).toMatchObject({ pointerScreen: { x: 200, y: 150 }, aimFromPointer: false });
  });

  it('gives the device back to the mouse that moves after it', () => {
    const input = createHarness();
    input.touch({ type: 'down', id: 1, control: null, x: 0, y: 0 });
    input.poll();
    input.pointer({ type: 'move', x: 5, y: 5 });

    const snapshot = input.poll();

    expect(snapshot).toMatchObject({ device: 'keyboardMouse', pointerScreen: { x: 5, y: 5 } });
  });
});

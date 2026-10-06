import { describe, expect, it } from 'vitest';
import { StandardButton } from './bindings';
import { fakeGamepad } from './fakes';
import {
  INITIAL_GAMEPAD_STATE,
  reduceGamepad,
  type GamepadLike,
  type GamepadState,
} from './gamepad';
import { INITIAL_HUB_STATE, stepHub, type HubState } from './hub';
import { INITIAL_MERGE_STATE, mergeFrames, type MergeState } from './merge';
import type { DeviceId, InputSnapshot } from './intents';
import {
  INITIAL_KEYBOARD_MOUSE_STATE,
  reduceKeyboard,
  reducePointer,
  takeKeyboardMouseFrame,
  type KeyEventLike,
  type PointerEventLike,
} from './keyboard-mouse';

function createHarness() {
  let keyboardMouse = INITIAL_KEYBOARD_MOUSE_STATE;
  let hub: HubState = INITIAL_HUB_STATE;
  let pads: (GamepadLike | null)[] = [];
  let merged: InputSnapshot | undefined;
  let reference: { gamepad: GamepadState; merge: MergeState; snapshot?: InputSnapshot } = {
    gamepad: INITIAL_GAMEPAD_STATE,
    merge: INITIAL_MERGE_STATE,
  };
  return {
    merged: () => merged,
    reference: () => reference.snapshot,
    key(type: KeyEventLike['type'], code: string) {
      keyboardMouse = reduceKeyboard(keyboardMouse, { type, code });
    },
    pointer(event: PointerEventLike) {
      keyboardMouse = reducePointer(keyboardMouse, event);
    },
    plug(...next: (GamepadLike | null)[]) {
      pads = next;
    },
    poll(now = 0): ReadonlyMap<DeviceId, InputSnapshot> {
      const taken = takeKeyboardMouseFrame(keyboardMouse);
      keyboardMouse = taken.state;
      const stepped = stepHub(hub, taken.frame, pads, now);
      hub = stepped.state;
      merged = stepped.merged;
      const pad = reduceGamepad(reference.gamepad, pads);
      const expected = mergeFrames(reference.merge, taken.frame, pad.frame, now);
      reference = { gamepad: pad.state, merge: expected.state, snapshot: expected.snapshot };
      return stepped.snapshots;
    },
  };
}

function snapshotOf(snapshots: ReadonlyMap<DeviceId, InputSnapshot>, device: DeviceId) {
  const snapshot = snapshots.get(device);
  if (snapshot === undefined) throw new Error(`No snapshot for ${device}`);
  return snapshot;
}

describe('input hub', () => {
  it('gives the keyboard and mouse a snapshot even with no gamepad', () => {
    const input = createHarness();

    const snapshots = input.poll();

    expect([...snapshots.keys()]).toEqual(['keyboardMouse']);
    expect(snapshotOf(snapshots, 'keyboardMouse').device).toBe('keyboardMouse');
  });

  it('gives two gamepads two independent snapshots', () => {
    const input = createHarness();
    input.plug(
      fakeGamepad({ index: 0, pressed: [StandardButton.A, StandardButton.RT] }),
      fakeGamepad({ index: 1 }),
    );

    const snapshots = input.poll();

    expect([...snapshots.keys()]).toEqual(['keyboardMouse', 'gamepad:0', 'gamepad:1']);
    const first = snapshotOf(snapshots, 'gamepad:0');
    const second = snapshotOf(snapshots, 'gamepad:1');
    expect(first.device).toBe('gamepad');
    expect(first.menu.confirm).toBe(true);
    expect(first.gameplay).toMatchObject({ placeTrap: true, fire: true });
    expect(second.menu.confirm).toBe(false);
    expect(second.gameplay).toMatchObject({ placeTrap: false, fire: false });
    expect(snapshotOf(snapshots, 'keyboardMouse').menu.confirm).toBe(false);
  });

  it('keeps the sticks of each gamepad apart', () => {
    const input = createHarness();
    input.plug(
      fakeGamepad({ index: 0, axes: [1, 0, 0, 0] }),
      fakeGamepad({ index: 1, axes: [0, 0, 0, -1] }),
    );

    const snapshots = input.poll();

    expect(snapshotOf(snapshots, 'gamepad:0').gameplay.move).toEqual({ x: 1, y: 0 });
    expect(snapshotOf(snapshots, 'gamepad:1').gameplay.move).toEqual({ x: 0, y: 0 });
    expect(snapshotOf(snapshots, 'gamepad:1').gameplay.aim).toEqual({ x: 0, y: -1 });
    expect(snapshotOf(snapshots, 'gamepad:0').aimFromPointer).toBe(false);
  });

  it('gives each gamepad its own menu edges and repeat', () => {
    const input = createHarness();
    input.plug(fakeGamepad({ index: 0, axes: [0, 1, 0, 0] }), fakeGamepad({ index: 1 }));
    input.poll(0);
    input.plug(
      fakeGamepad({ index: 0, axes: [0, 1, 0, 0] }),
      fakeGamepad({ index: 1, axes: [0, 1, 0, 0] }),
    );

    const late = input.poll(300);
    const repeated = input.poll(400);

    expect(snapshotOf(late, 'gamepad:0').menu.down).toBe(false);
    expect(snapshotOf(late, 'gamepad:1').menu.down).toBe(true);
    expect(snapshotOf(repeated, 'gamepad:0').menu.down).toBe(true);
    expect(snapshotOf(repeated, 'gamepad:1').menu.down).toBe(false);
  });

  it('lets the keyboard and a gamepad coexist', () => {
    const input = createHarness();
    input.key('keydown', 'Enter');
    input.plug(fakeGamepad({ index: 0, pressed: [StandardButton.B] }));

    const snapshots = input.poll();

    expect(snapshotOf(snapshots, 'keyboardMouse').menu).toMatchObject({
      confirm: true,
      back: false,
    });
    expect(snapshotOf(snapshots, 'gamepad:0').menu).toMatchObject({
      confirm: false,
      back: true,
    });
  });

  it('aims the keyboard and mouse snapshot from the pointer', () => {
    const input = createHarness();
    input.pointer({ type: 'move', x: 120, y: 80 });

    const snapshot = snapshotOf(input.poll(), 'keyboardMouse');

    expect(snapshot.aimFromPointer).toBe(true);
    expect(snapshot.pointerScreen).toEqual({ x: 120, y: 80 });
  });

  it('drops an unplugged gamepad and brings it back under the same identifier', () => {
    const input = createHarness();
    input.plug(fakeGamepad({ index: 0 }), fakeGamepad({ index: 1 }));
    input.poll();

    input.plug(fakeGamepad({ index: 0 }), null);
    const unplugged = input.poll();
    input.plug(fakeGamepad({ index: 0 }), fakeGamepad({ index: 1, pressed: [StandardButton.A] }));
    const replugged = input.poll();

    expect([...unplugged.keys()]).toEqual(['keyboardMouse', 'gamepad:0']);
    expect([...replugged.keys()]).toEqual(['keyboardMouse', 'gamepad:0', 'gamepad:1']);
    expect(snapshotOf(replugged, 'gamepad:1').menu.confirm).toBe(true);
  });

  it('ignores a gamepad that reports itself disconnected', () => {
    const input = createHarness();
    input.plug(fakeGamepad({ index: 0, connected: false }));

    expect([...input.poll().keys()]).toEqual(['keyboardMouse']);
  });
});

describe('merged view', () => {
  it('matches the single-source merge of the same frames', () => {
    const input = createHarness();
    input.key('keydown', 'KeyD');
    input.pointer({ type: 'move', x: 40, y: 20 });
    input.plug(
      fakeGamepad({ index: 1, axes: [0, 1, 0, 0.5], pressed: [StandardButton.A] }),
      fakeGamepad({ index: 2, pressed: [StandardButton.LT] }),
    );

    const polls = [0, 16, 32].map((now) => {
      input.poll(now);
      return [input.merged(), input.reference()] as const;
    });
    input.key('keyup', 'KeyD');
    input.plug(null, null);
    input.poll(48);

    for (const [merged, expected] of polls) expect(merged).toEqual(expected);
    expect(input.merged()).toEqual(input.reference());
    expect(polls[0]?.[0]?.device).toBe('gamepad');
  });
});

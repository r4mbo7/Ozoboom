import { describe, expect, it, vi } from 'vitest';
import { StandardButton } from './bindings';
import { fakeGamepad } from './fakes';
import {
  INITIAL_GAMEPAD_STATE,
  applyRadialDeadzone,
  reduceGamepad,
  rumbleGamepad,
  type GamepadLike,
} from './gamepad';

const length = ({ x, y }: { x: number; y: number }) => Math.sqrt(x * x + y * y);

describe('applyRadialDeadzone', () => {
  it('ignores a stick resting at 0.15', () => {
    expect(applyRadialDeadzone(0.15, 0)).toEqual({ x: 0, y: 0 });
    expect(applyRadialDeadzone(-0.1, 0.1)).toEqual({ x: 0, y: 0 });
  });

  it('returns a unit vector when the stick is pushed fully', () => {
    expect(applyRadialDeadzone(1, 0)).toEqual({ x: 1, y: 0 });
    expect(applyRadialDeadzone(0, -1)).toEqual({ x: 0, y: -1 });
    expect(length(applyRadialDeadzone(0.75, 0.75))).toBeCloseTo(1, 10);
  });

  it('rescales the live range between the dead zone and the edge', () => {
    const half = applyRadialDeadzone(0.36, 0.48);

    expect(length(half)).toBeCloseTo(0.5, 10);
    expect(half.x / half.y).toBeCloseTo(0.36 / 0.48, 10);
  });
});

describe('reduceGamepad', () => {
  it('reports a press only on the poll where the button goes down', () => {
    const pad = fakeGamepad({ pressed: [StandardButton.A] });

    const first = reduceGamepad(INITIAL_GAMEPAD_STATE, [pad]);
    const second = reduceGamepad(first.state, [pad]);

    expect(first.frame.presses).toEqual(['placeTrap', 'confirm']);
    expect(second.frame.presses).toEqual([]);
    expect([...second.frame.held]).toEqual(['placeTrap', 'confirm']);
  });

  it('presses a menu direction when the left stick is pushed, holds it while pushed', () => {
    const pad = fakeGamepad({ axes: [0, -0.9, 0, 0] });

    const first = reduceGamepad(INITIAL_GAMEPAD_STATE, [pad]);
    const second = reduceGamepad(first.state, [pad]);

    expect(first.frame.presses).toEqual(['menuUp']);
    expect(second.frame.presses).toEqual([]);
    expect([...second.frame.held]).toEqual(['menuUp']);
  });

  it('counts the push of another gamepad as a new press', () => {
    const first = reduceGamepad(INITIAL_GAMEPAD_STATE, [fakeGamepad({ axes: [1, 0, 0, 0] })]);

    const other = reduceGamepad(first.state, [null, fakeGamepad({ index: 1, axes: [1, 0, 0, 0] })]);

    expect(other.frame.presses).toEqual(['menuRight']);
  });

  it('stays inactive while the sticks rest inside the dead zone', () => {
    const pad = fakeGamepad({ axes: [0.15, 0, 0, -0.15] });

    const { frame } = reduceGamepad(INITIAL_GAMEPAD_STATE, [pad]);

    expect(frame).toMatchObject({ move: { x: 0, y: 0 }, aim: null, active: false });
  });

  it('counts an unbound button as activity', () => {
    const pad = fakeGamepad({ pressed: [StandardButton.LT] });

    const { frame } = reduceGamepad(INITIAL_GAMEPAD_STATE, [pad]);

    expect(frame.active).toBe(true);
    expect(frame.presses).toEqual([]);
  });

  it('uses the first connected gamepad', () => {
    const first = fakeGamepad({ index: 1, pressed: [StandardButton.X] });
    const second = fakeGamepad({ index: 2, pressed: [StandardButton.Y] });
    const unplugged = fakeGamepad({ index: 0, connected: false, pressed: [StandardButton.B] });

    const { frame, state } = reduceGamepad(INITIAL_GAMEPAD_STATE, [unplugged, first, second]);

    expect(frame.presses).toEqual(['skill']);
    expect(state.index).toBe(1);
  });

  it('keeps the gamepad in use when another one appears before it', () => {
    const inUse = reduceGamepad(INITIAL_GAMEPAD_STATE, [null, fakeGamepad({ index: 1 })]).state;

    const { state } = reduceGamepad(inUse, [fakeGamepad({ index: 0 }), fakeGamepad({ index: 1 })]);

    expect(state.index).toBe(1);
  });

  it('detects a disconnection', () => {
    const connected = reduceGamepad(INITIAL_GAMEPAD_STATE, [fakeGamepad()]);

    const unplugged = reduceGamepad(connected.state, [null]);
    const stillEmpty = reduceGamepad(unplugged.state, [null]);

    expect(connected.frame.disconnected).toBe(false);
    expect(unplugged.frame.disconnected).toBe(true);
    expect(unplugged.state).toEqual(INITIAL_GAMEPAD_STATE);
    expect(stillEmpty.frame.disconnected).toBe(false);
  });

  it('falls back to the next gamepad when the one in use is unplugged', () => {
    const inUse = reduceGamepad(INITIAL_GAMEPAD_STATE, [fakeGamepad({ index: 0 })]).state;

    const { frame, state } = reduceGamepad(inUse, [
      null,
      fakeGamepad({ index: 1, pressed: [StandardButton.RB] }),
    ]);

    expect(frame.disconnected).toBe(true);
    expect(frame.presses).toEqual(['nextTrap']);
    expect(state.index).toBe(1);
  });
});

describe('rumbleGamepad', () => {
  it('plays a dual rumble with the strength clamped to [0, 1]', () => {
    const playEffect = vi.fn<NonNullable<GamepadLike['vibrationActuator']>['playEffect']>(() =>
      Promise.resolve('complete'),
    );
    const pad = fakeGamepad({ vibrationActuator: { playEffect } });

    rumbleGamepad(pad, 1.5, 120);

    expect(playEffect).toHaveBeenCalledWith('dual-rumble', {
      duration: 120,
      strongMagnitude: 1,
      weakMagnitude: 1,
    });
  });

  it('does nothing without a vibration actuator or a gamepad', () => {
    expect(() => {
      rumbleGamepad(fakeGamepad(), 0.5, 100);
      rumbleGamepad(null, 0.5, 100);
    }).not.toThrow();
  });
});

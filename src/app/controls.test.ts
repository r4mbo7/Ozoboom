import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import type { TrapDefinition } from '../data/types';
import type { GameplayIntents, InputSnapshot } from '../input/intents';
import type { Vec2 } from '../sim/state';
import { Controls, NO_ASSIST, buildCommand } from './controls';

const PLAYER = { id: 0, x: 400, y: 300, radius: 14, aim: { x: 1, y: 0 } } as const;
const HAND_SIZE = 2;
const OUTWARD = { x: -1, y: 0 };
const REACH = 300;
const [CAISSON, LASER] = CONTENT.traps as [TrapDefinition, TrapDefinition];
const HOLDING = { ...PLAYER, hand: [CAISSON.id, LASER.id] };

// A camera whose screen origin is the world point (100, 50), at zoom 1.
const toWorld = (point: Vec2): Vec2 => ({ x: point.x + 100, y: point.y + 50 });

function snapshot(
  gameplay: Partial<GameplayIntents> = {},
  rest: Partial<Omit<InputSnapshot, 'gameplay'>> = {},
): InputSnapshot {
  return {
    device: 'keyboardMouse',
    gameplay: {
      move: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      fire: false,
      skill: false,
      placeTrap: false,
      nextTrap: false,
      previousTrap: false,
      selectTrap: null,
      pause: false,
      ...gameplay,
    },
    menu: { up: false, down: false, left: false, right: false, confirm: false, back: false },
    pointerScreen: null,
    aimFromPointer: false,
    ...rest,
  };
}

function expectVec(actual: Vec2, expected: Vec2): void {
  expect(actual.x).toBeCloseTo(expected.x, 9);
  expect(actual.y).toBeCloseTo(expected.y, 9);
}

describe('buildCommand', () => {
  it('aims from the player to the pointer and places the trap under the player', () => {
    const pointer = snapshot(
      { move: { x: 0.6, y: 0 }, fire: true },
      { pointerScreen: { x: 300, y: 650 }, aimFromPointer: true },
    );

    const command = buildCommand({
      snapshot: pointer,
      player: PLAYER,
      toWorld,
      heldAim: OUTWARD,
      trapId: LASER.id,
      placeTrap: true,
      upgradeId: null,
      assist: NO_ASSIST,
      target: null,
      trapScreen: null,
    });

    expect(command.playerId).toBe(0);
    expectVec(command.input.aim, { x: 0, y: 1 });
    expect(command.input).toMatchObject({ move: { x: 0.6, y: 0 }, fire: true, skill: false });
    expect(command.actions).toHaveLength(1);
    expect(command.actions[0]).toMatchObject({
      type: 'placeTrap',
      trapId: 'laser',
      x: PLAYER.x,
      y: PLAYER.y,
      dx: 0,
      dy: 1,
    });
  });

  it('keeps the current aim when the pointer is on the player', () => {
    const onPlayer = snapshot({}, { pointerScreen: { x: 300, y: 250 }, aimFromPointer: true });

    const command = buildCommand({
      snapshot: onPlayer,
      player: { ...PLAYER, aim: { x: 0, y: -1 } },
      toWorld,
      heldAim: OUTWARD,
      trapId: CAISSON.id,
      placeTrap: false,
      upgradeId: null,
      assist: NO_ASSIST,
      target: null,
      trapScreen: null,
    });

    expectVec(command.input.aim, { x: 0, y: -1 });
  });

  it('aims with the held aim and places the trap under the player without a pointer', () => {
    const stick = snapshot({ aim: { x: 0, y: -1 } }, { device: 'gamepad' });

    const command = buildCommand({
      snapshot: stick,
      player: PLAYER,
      toWorld,
      heldAim: { x: 0, y: -1 },
      trapId: CAISSON.id,
      placeTrap: true,
      upgradeId: 'double-tempo',
      assist: NO_ASSIST,
      target: null,
      trapScreen: null,
    });

    expectVec(command.input.aim, { x: 0, y: -1 });
    expect(command.actions).toEqual([
      { type: 'placeTrap', trapId: CAISSON.id, x: PLAYER.x, y: PLAYER.y, dx: 0, dy: -1 },
      { type: 'chooseUpgrade', upgradeId: 'double-tempo' },
    ]);
  });

  it('places nothing when no trap is selected', () => {
    const command = buildCommand({
      snapshot: snapshot(),
      player: PLAYER,
      toWorld,
      heldAim: OUTWARD,
      trapId: undefined,
      placeTrap: true,
      upgradeId: null,
      assist: NO_ASSIST,
      target: null,
      trapScreen: null,
    });

    expect(command.actions).toEqual([]);
  });
});

describe('Controls', () => {
  it('aims away from the scene before any input', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(snapshot());

    const command = controls.command(HOLDING, toWorld, [], REACH);

    expectVec(command.input.aim, OUTWARD);
  });

  it('aims the keyboard where the player last moved', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(snapshot({ move: { x: 0.7071, y: 0.7071 } }));
    controls.frame(snapshot({ move: { x: 0, y: 0 } }));

    const command = controls.command(HOLDING, toWorld, [], REACH);

    expectVec(command.input.aim, { x: Math.SQRT1_2, y: Math.SQRT1_2 });
  });

  it('aims with the right stick once it moves, and not with the left one', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(snapshot({}, { device: 'gamepad' }));
    controls.frame(snapshot({ move: { x: 0, y: 1 } }, { device: 'gamepad' }));
    const beforeStick = controls.command(HOLDING, toWorld, [], REACH);
    controls.frame(snapshot({ aim: { x: 0, y: -1 } }, { device: 'gamepad' }));

    const afterStick = controls.command(HOLDING, toWorld, [], REACH);

    expectVec(beforeStick.input.aim, OUTWARD);
    expectVec(afterStick.input.aim, { x: 0, y: -1 });
  });

  it('sends a trap placed during a frame without steps with the next step, once', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(snapshot({ placeTrap: true }));
    controls.frame(snapshot());

    const first = controls.command(HOLDING, toWorld, [], REACH);
    const second = controls.command(HOLDING, toWorld, [], REACH);

    expect(first.actions).toEqual([
      expect.objectContaining({ type: 'placeTrap', trapId: CAISSON.id }),
    ]);
    expect(second.actions).toEqual([]);
  });

  it('selects the trap like the interface does, from a 0-based slot or a cycle', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(snapshot({ selectTrap: 1, placeTrap: true }));
    const bySlot = controls.command(HOLDING, toWorld, [], REACH);
    controls.frame(snapshot({ nextTrap: true, placeTrap: true }));

    const byCycle = controls.command(HOLDING, toWorld, [], REACH);

    expect(bySlot.actions[0]).toMatchObject({ trapId: LASER.id });
    expect(byCycle.actions[0]).toMatchObject({ trapId: CAISSON.id });
  });

  it('places the last trap held when the selected slot is empty', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(snapshot({ selectTrap: 1, placeTrap: true }));

    const command = controls.command({ ...PLAYER, hand: [LASER.id] }, toWorld, [], REACH);

    expect(command.actions).toEqual([expect.objectContaining({ trapId: LASER.id })]);
  });

  it('places nothing with empty hands', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(snapshot({ placeTrap: true }));

    const command = controls.command({ ...PLAYER, hand: [] }, toWorld, [], REACH);

    expect(command.actions).toEqual([]);
  });

  it('sends the chosen upgrade with the next step, once', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(snapshot());
    controls.chooseUpgrade('double-tempo');

    const first = controls.command(HOLDING, toWorld, [], REACH);
    const second = controls.command(HOLDING, toWorld, [], REACH);

    expect(first.actions).toEqual([{ type: 'chooseUpgrade', upgradeId: 'double-tempo' }]);
    expect(second.actions).toEqual([]);
  });

  it('aims and fires a touch screen at the nearest bad vibe in reach', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    const near = { x: 400, y: 500, radius: 10, hp: 5 };
    const nearer = { x: 400, y: 100, radius: 10, hp: 0 };
    const far = { x: 400 + REACH + 20, y: 300, radius: 10, hp: 5 };
    controls.frame(snapshot({}, { device: 'touch' }));

    const command = controls.command(HOLDING, toWorld, [nearer, far, near], REACH);

    expectVec(command.input.aim, { x: 0, y: 1 });
    expect(command.input.fire).toBe(true);
  });

  it('holds fire on a touch screen with no bad vibe in reach, and aims where it moved', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    const far = { x: 400, y: 300 + REACH + 20, radius: 10, hp: 5 };
    controls.frame(snapshot({ move: { x: 0, y: -1 } }, { device: 'touch' }));

    const command = controls.command(HOLDING, toWorld, [far], REACH);

    expectVec(command.input.aim, { x: 0, y: -1 });
    expect(command.input.fire).toBe(false);
  });

  it('never aims a keyboard by itself', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(snapshot());

    const command = controls.command(
      PLAYER,
      toWorld,
      [{ x: 400, y: 320, radius: 10, hp: 5 }],
      REACH,
    );

    expectVec(command.input.aim, OUTWARD);
    expect(command.input.fire).toBe(false);
  });

  it('fires a keyboard by itself at a bad vibe in reach, where the player aims, with automatic fire', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(snapshot());

    const command = controls.command(
      PLAYER,
      toWorld,
      [{ x: 400, y: 320, radius: 10, hp: 5 }],
      REACH,
      { autoFire: true, autoAim: false },
    );

    expectVec(command.input.aim, OUTWARD);
    expect(command.input.fire).toBe(true);
  });

  it('aims a gamepad at the nearest bad vibe in reach without firing, with automatic aim', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(snapshot({}, { device: 'gamepad' }));

    const command = controls.command(
      PLAYER,
      toWorld,
      [{ x: 400, y: 320, radius: 10, hp: 5 }],
      REACH,
      { autoFire: false, autoAim: true },
    );

    expectVec(command.input.aim, { x: 0, y: 1 });
    expect(command.input.fire).toBe(false);
  });

  it('keeps the mouse aim and holds fire with both assists and no bad vibe in reach', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(snapshot({}, { pointerScreen: { x: 300, y: 350 }, aimFromPointer: true }));

    const command = controls.command(
      PLAYER,
      toWorld,
      [{ x: 400, y: 300 + REACH + 20, radius: 10, hp: 5 }],
      REACH,
      { autoFire: true, autoAim: true },
    );

    expectVec(command.input.aim, { x: 0, y: 1 });
    expect(command.input.fire).toBe(false);
  });

  it('places a trap where a finger dropped it, even after a frame without steps', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(
      snapshot({ placeTrap: true }, { device: 'touch', pointerScreen: { x: 20, y: 30 } }),
    );
    controls.frame(snapshot({}, { device: 'touch' }));

    const command = controls.command(HOLDING, toWorld, [], REACH);

    expect(command.actions[0]).toMatchObject({ type: 'placeTrap', x: 120, y: 80 });
  });

  it('places a tapped trap under the player', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(snapshot({ placeTrap: true }, { device: 'touch' }));

    const command = controls.command(HOLDING, toWorld, [], REACH);

    expect(command.actions[0]).toMatchObject({ type: 'placeTrap', x: PLAYER.x, y: PLAYER.y });
  });

  it('keeps placing a keyboard trap under the player wherever the mouse is', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);
    controls.frame(snapshot({ placeTrap: true }, { pointerScreen: { x: 20, y: 30 } }));

    const command = controls.command(HOLDING, toWorld, [], REACH);

    expect(command.actions[0]).toMatchObject({ type: 'placeTrap', x: PLAYER.x, y: PLAYER.y });
  });

  it('idles before its first frame', () => {
    const controls = new Controls(HAND_SIZE, OUTWARD);

    const command = controls.command(HOLDING, toWorld, [], REACH);

    expect(command).toEqual({
      playerId: 0,
      input: {
        move: { x: 0, y: 0 },
        aim: { x: 1, y: 0 },
        fire: false,
        skill: false,
      },
      actions: [],
    });
  });
});

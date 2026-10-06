import { describe, expect, it } from 'vitest';
import { TOUCH_STICK_RADIUS } from './bindings';
import {
  INITIAL_TOUCH_STATE,
  parseTouchControl,
  reduceTouch,
  releaseTouches,
  takeTouchFrame,
  type TouchControl,
  type TouchEventLike,
  type TouchState,
} from './touch';

function play(...events: TouchEventLike[]): TouchState {
  return events.reduce(reduceTouch, INITIAL_TOUCH_STATE);
}

const down = (id: number, control: TouchControl | null, x = 0, y = 0) =>
  ({ type: 'down', id, control, x, y }) as const;
const move = (id: number, x: number, y: number, onArena = true) =>
  ({ type: 'move', id, x, y, onArena }) as const;
const up = (id: number, x: number, y: number, onArena = true) =>
  ({ type: 'up', id, x, y, onArena }) as const;

describe('parseTouchControl', () => {
  it('reads the controls of the arena and the HUD, and nothing else', () => {
    expect(['stick', 'skill', 'pause', 'trap:0', 'trap:4'].map(parseTouchControl)).toEqual([
      'stick',
      'skill',
      'pause',
      'trap:0',
      'trap:4',
    ]);
    expect(['trap:5', 'trap:', 'fire', undefined].map(parseTouchControl)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});

describe('the virtual stick', () => {
  it('moves the player from where the thumb landed', () => {
    const state = play(down(1, 'stick', 100, 100), move(1, 100 + TOUCH_STICK_RADIUS, 100));

    const { frame } = takeTouchFrame(state);

    expect(frame.move).toEqual({ x: 1, y: 0 });
    expect(frame.active).toBe(true);
  });

  it('ignores a thumb that barely moves', () => {
    const state = play(down(1, 'stick', 100, 100), move(1, 103, 102));

    expect(takeTouchFrame(state).frame.move).toEqual({ x: 0, y: 0 });
  });

  it('follows the thumb past its rim, so turning back answers at once', () => {
    const state = play(
      down(1, 'stick', 100, 100),
      move(1, 100 + 3 * TOUCH_STICK_RADIUS, 100),
      move(1, 100 + TOUCH_STICK_RADIUS, 100),
    );

    expect(takeTouchFrame(state).frame.move).toEqual({ x: -1, y: 0 });
  });

  it('stops when the thumb lifts, and keeps a second finger off it', () => {
    const lifted = play(
      down(1, 'stick', 0, 0),
      down(2, 'stick', 50, 50),
      move(2, 99, 50),
      up(1, 0, 0),
    );

    expect(takeTouchFrame(lifted).frame.move).toEqual({ x: 0, y: 0 });
  });
});

describe('the HUD controls', () => {
  it('holds the skill while a finger stays on it', () => {
    const held = takeTouchFrame(play(down(1, 'skill')));
    const stillHeld = takeTouchFrame(held.state);
    const released = takeTouchFrame(reduceTouch(stillHeld.state, up(1, 0, 0, false)));

    expect(held.frame.held).toEqual(new Set(['skill']));
    expect(stillHeld.frame.held).toEqual(new Set(['skill']));
    expect(released.frame.held).toEqual(new Set());
  });

  it('casts the skill on a tap shorter than a frame, for that frame only', () => {
    const tapped = takeTouchFrame(play(down(1, 'skill'), up(1, 0, 0, false)));

    expect(tapped.frame.held).toEqual(new Set(['skill']));
    expect(takeTouchFrame(tapped.state).frame.held).toEqual(new Set());
  });

  it('presses pause once', () => {
    const { frame, state } = takeTouchFrame(play(down(1, 'pause')));

    expect(frame.presses).toEqual(['pause']);
    expect(takeTouchFrame(state).frame.presses).toEqual([]);
  });

  it('selects a tapped trap and places it under the player', () => {
    const { frame } = takeTouchFrame(play(down(1, 'trap:1', 10, 10), up(1, 12, 10, false)));

    expect(frame.presses).toEqual(['selectTrap2', 'placeTrap']);
    expect(frame.drop).toBeNull();
  });

  it('places a trap dragged onto the arena where the finger lifts', () => {
    const state = play(down(1, 'trap:0', 10, 400), move(1, 200, 300), up(1, 220, 280));

    const { frame } = takeTouchFrame(state);

    expect(frame.presses).toEqual(['selectTrap1', 'placeTrap']);
    expect(frame.drop).toEqual({ x: 220, y: 280 });
  });

  it('keeps a trap dragged back onto the HUD', () => {
    const state = play(down(1, 'trap:0', 10, 400), move(1, 200, 300), up(1, 12, 400, false));

    expect(takeTouchFrame(state).frame.presses).toEqual(['selectTrap1']);
  });

  it('keeps a trap whose touch the browser cancels', () => {
    const state = play(down(1, 'trap:0'), { type: 'cancel', id: 1 });

    expect(takeTouchFrame(state).frame.presses).toEqual(['selectTrap1']);
  });
});

describe('any touch', () => {
  it('tells that the player is on a touch screen, without a control', () => {
    const { frame } = takeTouchFrame(play(down(1, null)));

    expect(frame).toMatchObject({ active: true, presses: [], move: { x: 0, y: 0 } });
  });

  it('lets go of everything when the window loses focus', () => {
    const state = releaseTouches(play(down(1, 'stick'), move(1, 90, 0), down(2, 'skill')));

    const { frame } = takeTouchFrame(state);

    expect(frame.move).toEqual({ x: 0, y: 0 });
    expect(frame.held).toEqual(new Set());
  });
});

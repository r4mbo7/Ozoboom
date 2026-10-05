import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import type { DeviceId, InputSnapshot } from '../input/intents';
import { createLocalSource } from '../net/local';
import type { CommandSource } from '../net/types';
import type { PlayerCommand } from '../sim/commands';
import type { PlayerId } from '../sim/state';
import { IDLE_SNAPSHOT, createMatch, withoutPressesView, type InputView } from './match';

const toWorld = (point: { x: number; y: number }) => point;

function snapshot(move: { x: number; y: number }, fire = false): InputSnapshot {
  return {
    ...IDLE_SNAPSHOT,
    device: 'gamepad',
    gameplay: { ...IDLE_SNAPSHOT.gameplay, move, fire },
  };
}

function view(devices: [DeviceId, InputSnapshot][]): InputView {
  return { devices: new Map(devices), merged: IDLE_SNAPSHOT };
}

function recording() {
  const seen: PlayerCommand[][] = [];
  const source: CommandSource = {
    ...createLocalSource(),
    next(local) {
      seen.push([...local]);
      return local;
    },
  };
  return { source, seen };
}

function twoPlayers(source: CommandSource = createLocalSource()) {
  return createMatch({
    seed: 3,
    setId: 'soiree-v0',
    content: CONTENT,
    slots: [
      { id: 0, classId: 'mage', name: 'Ana' },
      { id: 1, classId: 'tank', name: 'Bob' },
    ],
    locals: new Map<PlayerId, DeviceId | null>([
      [0, 'keyboardMouse'],
      [1, 'gamepad:0'],
    ]),
    source,
    focus: { kind: 'everyone' },
  });
}

describe('a local match', () => {
  it('sends one command per player, each from its own device, through the source', () => {
    const { source, seen } = recording();
    const match = twoPlayers(source);

    match.frame(
      view([
        ['keyboardMouse', snapshot({ x: 1, y: 0 }, true)],
        ['gamepad:0', snapshot({ x: 0, y: -1 })],
      ]),
    );
    const stepped = match.step(toWorld);

    expect(stepped).toBe(true);
    const [commands] = seen;
    expect(commands?.map((command) => command.playerId)).toEqual([0, 1]);
    expect(commands?.[0]?.input).toMatchObject({ move: { x: 1, y: 0 }, fire: true });
    expect(commands?.[1]?.input).toMatchObject({ move: { x: 0, y: -1 }, fire: false });
    expect(match.session.state.tick).toBe(1);
  });

  it('waits while the source has nothing, and tells the source after each step', () => {
    let ready = false;
    let stepped = 0;
    const source: CommandSource = {
      next: (local) => (ready ? local : null),
      stepped: () => {
        stepped += 1;
      },
      pending: 0,
      close: () => undefined,
    };
    const match = twoPlayers(source);
    match.frame(view([]));

    expect(match.step(toWorld)).toBe(false);
    expect(match.session.state.tick).toBe(0);
    ready = true;
    expect(match.step(toWorld)).toBe(true);
    expect(stepped).toBe(1);
  });

  it('routes a card choice to the player who made it, once', () => {
    const { source, seen } = recording();
    const match = twoPlayers(source);
    match.frame(view([]));

    match.chooseUpgrade(1, 'any-card');
    match.step(toWorld);
    match.step(toWorld);

    expect(seen.map((commands) => commands.map((command) => command.actions.length))).toEqual([
      [0, 1],
      [0, 0],
    ]);
  });

  it('keeps a player whose controller is gone standing still', () => {
    const match = twoPlayers();

    match.frame(view([['keyboardMouse', snapshot({ x: 1, y: 0 })]]));

    expect(match.players.map((player) => player.snapshot.gameplay.move)).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]);
  });

  it('lists its seats with names, classes and devices', () => {
    const match = twoPlayers();

    expect(match.seats).toEqual([
      { playerId: 0, name: 'Ana', classId: 'mage', device: 'keyboardMouse', local: true },
      { playerId: 1, name: 'Bob', classId: 'tank', device: 'gamepad:0', local: true },
    ]);
    expect(match.focus).toEqual({ kind: 'everyone' });
  });

  it('lets a solo player read the merged view', () => {
    const match = createMatch({
      seed: 3,
      setId: 'soiree-v0',
      content: CONTENT,
      slots: [{ id: 0, classId: 'mage' }],
      locals: new Map([[0, null]]),
      source: createLocalSource(),
      focus: { kind: 'player', playerId: 0 },
    });

    match.frame({ devices: new Map(), merged: snapshot({ x: 0, y: 1 }) });

    expect(match.players).toEqual([{ playerId: 0, snapshot: snapshot({ x: 0, y: 1 }) }]);
    expect(match.seats[0]?.name).toBeNull();
  });
});

describe('withoutPressesView', () => {
  it('keeps the movement and drops every press of every device', () => {
    const pressed = {
      ...snapshot({ x: 1, y: 0 }, true),
      menu: { ...IDLE_SNAPSHOT.menu, confirm: true },
    };

    const quiet = withoutPressesView({
      devices: new Map([['gamepad:0', pressed]]),
      merged: pressed,
    });

    expect(quiet.merged.gameplay).toMatchObject({ move: { x: 1, y: 0 }, fire: false });
    expect(quiet.devices.get('gamepad:0')?.menu.confirm).toBe(false);
  });
});

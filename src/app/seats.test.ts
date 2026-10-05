import { describe, expect, it } from 'vitest';
import { createSeats } from './seats';

const CLASSES = ['mage', 'tank', 'healer'];

function seats() {
  return createSeats(CLASSES, 'tank');
}

function summary(lobby: ReturnType<typeof seats>) {
  return lobby.model().seats.map(({ playerId, device, classId, host }) => ({
    playerId,
    device,
    classId,
    host,
  }));
}

describe('local seats', () => {
  it('gives each device the first free place, with the remembered class first then a fresh one', () => {
    const lobby = seats();

    lobby.join('keyboardMouse');
    lobby.join('gamepad:0');

    expect(summary(lobby)).toEqual([
      { playerId: 0, device: 'keyboardMouse', classId: 'tank', host: true },
      { playerId: 1, device: 'gamepad:0', classId: 'mage', host: false },
    ]);
  });

  it('refuses a device that already has a place, and a fifth device', () => {
    const lobby = seats();
    lobby.join('keyboardMouse');

    expect(lobby.join('keyboardMouse')).toBe(false);
    expect(lobby.join('gamepad:0')).toBe(true);
    expect(lobby.join('gamepad:1')).toBe(true);
    expect(lobby.join('gamepad:2')).toBe(true);
    expect(lobby.join('gamepad:3')).toBe(false);
  });

  it('frees a place for the next device and passes the launch to the lowest one left', () => {
    const lobby = seats();
    lobby.join('keyboardMouse');
    lobby.join('gamepad:0');
    lobby.join('gamepad:1');

    lobby.leave(0);
    lobby.join('gamepad:2');

    expect(summary(lobby).map(({ playerId, device, host }) => [playerId, device, host])).toEqual([
      [0, 'gamepad:2', true],
      [1, 'gamepad:0', false],
      [2, 'gamepad:1', false],
    ]);
  });

  it('keeps the names and classes it is given, trimmed, with a default for an empty name', () => {
    const lobby = seats();
    lobby.join('keyboardMouse');

    lobby.setName(0, '  Constantin De La Roche ');
    lobby.setClass(0, 'healer');
    lobby.setClass(0, 'unknown');

    expect(lobby.model().seats[0]).toMatchObject({ name: 'Constantin D', classId: 'healer' });
    lobby.setName(0, '   ');
    expect(lobby.model().seats[0]?.name).toBe('Joueur 1');
  });

  it('launches players numbered from 0 in seat order, each with its device', () => {
    const lobby = seats();
    lobby.join('keyboardMouse');
    lobby.join('gamepad:0');
    lobby.join('gamepad:1');
    lobby.leave(0);

    const { slots, locals } = lobby.launch();

    expect(slots.map((slot) => slot.id)).toEqual([0, 1]);
    expect(slots.map((slot) => slot.name)).toEqual(['Joueur 2', 'Joueur 3']);
    expect([...locals]).toEqual([
      [0, 'gamepad:0'],
      [1, 'gamepad:1'],
    ]);
  });

  it('cannot launch without a player', () => {
    expect(seats().model().canLaunch).toBe(false);
  });
});

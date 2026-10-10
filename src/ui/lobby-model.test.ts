import { describe, expect, it } from 'vitest';
import {
  deviceLabel,
  lobbyView,
  normalizeRoomCode,
  ownSeat,
  roomCodeFromHash,
  rowsOf,
  seatName,
  seatRows,
  stepClass,
  stepRow,
} from './lobby-model';
import { STAGE_CARDS } from './lobby-fixtures';
import { NO_MENU_INTENTS } from './navigation';
import type { LobbyModel, LobbySeat } from './types';

const CLASSES = [{ id: 'mage' }, { id: 'tank' }, { id: 'healer' }];

function seat(overrides: Partial<LobbySeat> = {}): LobbySeat {
  return {
    playerId: 0,
    name: 'Joueur 1',
    classId: 'mage',
    device: 'keyboardMouse',
    remote: false,
    host: true,
    ...overrides,
  };
}

function lobby(overrides: Partial<LobbyModel> = {}): LobbyModel {
  return {
    mode: 'online',
    role: 'host',
    code: 'K7M2QX',
    link: 'https://ozoboom.example/#rejoindre=K7M2QX',
    seats: [seat()],
    canLaunch: true,
    error: null,
    ...overrides,
  };
}

describe('normalizeRoomCode', () => {
  it('ignores spaces and case', () => {
    expect(normalizeRoomCode('  k7m 2qx ')).toBe('K7M2QX');
  });

  it('takes the code out of a pasted link', () => {
    expect(normalizeRoomCode('https://ozoboom.example/#rejoindre=k7m2qx')).toBe('K7M2QX');
  });

  it('reads the code of the page hash, and nothing without one', () => {
    expect(roomCodeFromHash('#rejoindre=k7m2qx')).toBe('K7M2QX');
    expect(roomCodeFromHash('')).toBe('');
  });
});

describe('seatName', () => {
  it('keeps twelve characters', () => {
    expect(seatName('Constantin de la Roche', 1)).toBe('Constantin d');
  });

  it('falls back to the numbered default', () => {
    expect(seatName('   ', 2)).toBe('Joueur 3');
  });
});

describe('stepClass', () => {
  it('wraps both ways', () => {
    expect(stepClass(CLASSES, 'healer', 1)).toBe('mage');
    expect(stepClass(CLASSES, 'mage', -1)).toBe('healer');
  });

  it('has nothing to step through with one class', () => {
    expect(stepClass([{ id: 'mage' }], 'mage', 1)).toBeNull();
  });
});

describe('lobby views', () => {
  it('splits online between the entry and the room', () => {
    expect(lobbyView(lobby({ code: null, seats: [] }))).toBe('entry');
    expect(lobbyView(lobby())).toBe('room');
    expect(lobbyView(lobby({ mode: 'local', code: null }))).toBe('local');
  });

  it('offers the host its link, its seat and the launch', () => {
    expect(rowsOf(lobby())).toEqual(['copy', 'name', 'class', 'launch', 'leave']);
  });

  it('offers a guest its seat and the way out only', () => {
    const guest = lobby({
      role: 'guest',
      seats: [seat({ remote: true }), seat({ playerId: 1, host: false })],
    });
    expect(ownSeat(guest)?.playerId).toBe(1);
    expect(rowsOf(guest)).toEqual(['name', 'class', 'leave']);
  });

  it('offers the entry its two ways in', () => {
    expect(rowsOf(lobby({ code: null, seats: [] }))).toEqual(['create', 'code', 'join', 'leave']);
  });
});

describe('stepRow', () => {
  it('moves down, wraps, and reads the sides apart', () => {
    expect(stepRow(3, 2, { ...NO_MENU_INTENTS, down: true }).index).toBe(0);
    expect(stepRow(3, 0, { ...NO_MENU_INTENTS, up: true }).index).toBe(2);
    expect(stepRow(3, 1, { ...NO_MENU_INTENTS, left: true })).toMatchObject({ index: 1, side: -1 });
  });
});

describe('deviceLabel', () => {
  it('names each device', () => {
    expect(deviceLabel('keyboardMouse')).toBe('Clavier et souris');
    expect(deviceLabel('gamepad:1')).toBe('Manette 2');
    expect(deviceLabel(null)).toBe('À distance');
  });
});

describe('the scene row', () => {
  it('belongs to the host when there is a scene to choose', () => {
    const stages = { stages: STAGE_CARDS, stageId: 'dome' };

    expect(rowsOf(lobby(stages))).toEqual(['copy', 'name', 'class', 'stage', 'launch', 'leave']);
    expect(seatRows(seat(), lobby(stages))).toEqual(['name', 'class', 'stage', 'launch', 'online']);
  });

  it('is left out for a guest, and without a choice', () => {
    const guest = seat({ host: false });

    expect(rowsOf(lobby({ stages: STAGE_CARDS, seats: [guest] }))).toEqual([
      'name',
      'class',
      'leave',
    ]);
    expect(rowsOf(lobby({ stages: STAGE_CARDS.slice(0, 1) }))).not.toContain('stage');
    expect(seatRows(guest, lobby({ stages: STAGE_CARDS }))).toEqual(['name', 'class']);
  });
});

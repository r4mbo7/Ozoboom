import type { DeviceId, InputDevice, MenuIntents } from '../input/intents';
import type { PlayerId } from '../sim/state';
import type { LobbyModel, LobbySeat } from './types';

export const SEAT_IDS: readonly PlayerId[] = [0, 1, 2, 3];
export const SEAT_COUNT = SEAT_IDS.length;
export const NAME_LENGTH = 12;
const ROOM_LINK = /rejoindre=([^&\s]+)/i;

// A code typed by hand or pasted from the link: spaces and case do not matter.
export function normalizeRoomCode(raw: string): string {
  const linked = ROOM_LINK.exec(raw);
  return (linked?.[1] ?? raw).replace(/\s+/g, '').toUpperCase();
}

export function roomCodeFromHash(hash: string): string {
  return normalizeRoomCode(ROOM_LINK.exec(hash)?.[0] ?? '');
}

export function defaultName(playerId: PlayerId): string {
  return `Joueur ${String(playerId + 1)}`;
}

export function seatName(raw: string, playerId: PlayerId): string {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, NAME_LENGTH).trim();
  return name === '' ? defaultName(playerId) : name;
}

export function stepClass(
  classes: readonly { id: string }[],
  current: string,
  delta: number,
): string | null {
  if (classes.length < 2) {
    return null;
  }
  const index = Math.max(
    classes.findIndex((entry) => entry.id === current),
    0,
  );
  const next = (((index + delta) % classes.length) + classes.length) % classes.length;
  return classes[next]?.id ?? null;
}

export type LobbyView = 'local' | 'entry' | 'room';

export function lobbyView(model: LobbyModel): LobbyView {
  if (model.mode === 'local') {
    return 'local';
  }
  return model.code === null ? 'entry' : 'room';
}

// The seat this screen edits online: the only one that is not played from afar.
export function ownSeat(model: LobbyModel): LobbySeat | null {
  return model.seats.find((seat) => !seat.remote) ?? null;
}

export function seatAt(model: LobbyModel, playerId: PlayerId): LobbySeat | null {
  return model.seats.find((seat) => seat.playerId === playerId) ?? null;
}

// The merged snapshot only says which kind of device spoke: a pad is the first one until the frame
// says more.
export function deviceOf(device: InputDevice): DeviceId | null {
  if (device === 'keyboardMouse') {
    return 'keyboardMouse';
  }
  return device === 'gamepad' ? 'gamepad:0' : null;
}

export function deviceLabel(device: DeviceId | null): string {
  if (device === null) {
    return 'À distance';
  }
  if (device === 'keyboardMouse') {
    return 'Clavier et souris';
  }
  return `Manette ${String(Number(device.slice('gamepad:'.length)) + 1)}`;
}

export type Row =
  'create' | 'code' | 'join' | 'copy' | 'name' | 'class' | 'launch' | 'online' | 'leave';

export function rowsOf(model: LobbyModel): readonly Row[] {
  const view = lobbyView(model);
  if (view === 'entry') {
    return ['create', 'code', 'join', 'leave'];
  }
  const own = ownSeat(model);
  const rows: Row[] = [];
  if (view === 'room' && own?.host === true) {
    rows.push('copy');
  }
  if (own !== null) {
    rows.push('name', 'class');
  }
  if (own?.host === true) {
    rows.push('launch');
  }
  rows.push('leave');
  return rows;
}

export function seatRows(seat: LobbySeat): readonly Row[] {
  return seat.host ? ['name', 'class', 'launch', 'online'] : ['name', 'class'];
}

export interface RowStep {
  index: number;
  confirmed: boolean;
  back: boolean;
  side: -1 | 0 | 1;
}

export function stepRow(count: number, index: number, edges: MenuIntents): RowStep {
  const side = (edges.right ? 1 : 0) - (edges.left ? 1 : 0);
  const delta = (edges.down ? 1 : 0) - (edges.up ? 1 : 0);
  const next = count <= 0 ? 0 : (((index + delta) % count) + count) % count;
  return {
    index: next,
    confirmed: edges.confirm,
    back: edges.back,
    side: side > 0 ? 1 : side < 0 ? -1 : 0,
  };
}

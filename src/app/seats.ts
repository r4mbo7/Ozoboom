import type { DeviceId } from '../input/intents';
import { trimPlayerName } from '../shared/player-name';
import type { PlayerSlot } from '../sim/initial-state';
import type { PlayerId } from '../sim/state';
import { SEAT_IDS, defaultName, type LobbyModel, type LobbySeat } from '../ui';

interface Seat {
  playerId: PlayerId;
  device: DeviceId;
  name: string;
  classId: string;
}

export interface LaunchedSeats {
  slots: readonly PlayerSlot[];
  locals: ReadonlyMap<PlayerId, DeviceId>;
}

// The seats of a local lobby: one device each, the first free place first, the lowest one launches.
// Places keep their number while others come and go, so a cursor stays on its own place.
export interface Seats {
  readonly count: number;
  join(device: DeviceId): boolean;
  leave(playerId: PlayerId): boolean;
  setClass(playerId: PlayerId, classId: string): void;
  setName(playerId: PlayerId, name: string): void;
  clear(): void;
  deviceOf(playerId: PlayerId): DeviceId | null;
  model(): LobbyModel;
  // Players numbered 0 to n - 1 in seat order, as the sim wants them.
  launch(): LaunchedSeats;
}

export function createSeats(classIds: readonly string[], firstClassId: string): Seats {
  let seats: Seat[] = [];

  const sorted = () => [...seats].sort((a, b) => a.playerId - b.playerId);
  const find = (playerId: PlayerId) => seats.find((seat) => seat.playerId === playerId);

  // A class not yet in the lobby, so that two friends do not both start on the same one: the class
  // remembered from the title leads, the others follow in order.
  function freshClass(): string {
    const taken = new Set(seats.map((seat) => seat.classId));
    const order = seats.length === 0 ? [firstClassId, ...classIds] : classIds;
    return order.find((id) => !taken.has(id)) ?? order[0] ?? firstClassId;
  }

  return {
    get count() {
      return seats.length;
    },
    join(device) {
      if (seats.length >= SEAT_IDS.length || seats.some((seat) => seat.device === device)) {
        return false;
      }
      const playerId = SEAT_IDS.find((id) => find(id) === undefined);
      if (playerId === undefined) {
        return false;
      }
      seats.push({ playerId, device, name: defaultName(playerId), classId: freshClass() });
      return true;
    },
    leave(playerId) {
      const before = seats.length;
      seats = seats.filter((seat) => seat.playerId !== playerId);
      return seats.length < before;
    },
    setClass(playerId, classId) {
      const seat = find(playerId);
      if (seat !== undefined && classIds.includes(classId)) {
        seat.classId = classId;
      }
    },
    setName(playerId, name) {
      const seat = find(playerId);
      if (seat !== undefined) {
        seat.name = trimPlayerName(name) || defaultName(playerId);
      }
    },
    clear() {
      seats = [];
    },
    deviceOf: (playerId) => find(playerId)?.device ?? null,
    model() {
      const lobbySeats: LobbySeat[] = sorted().map((seat, index) => ({
        playerId: seat.playerId,
        name: seat.name,
        classId: seat.classId,
        device: seat.device,
        remote: false,
        host: index === 0,
      }));
      return {
        mode: 'local',
        role: 'host',
        code: null,
        link: null,
        seats: lobbySeats,
        canLaunch: lobbySeats.length > 0,
        error: null,
      };
    },
    launch() {
      const ordered = sorted();
      const slots: PlayerSlot[] = [];
      const locals = new Map<PlayerId, DeviceId>();
      for (const [index, seat] of ordered.entries()) {
        const id = SEAT_IDS[index];
        if (id !== undefined) {
          slots.push({ id, classId: seat.classId, name: seat.name });
          locals.set(id, seat.device);
        }
      }
      return { slots, locals };
    },
  };
}

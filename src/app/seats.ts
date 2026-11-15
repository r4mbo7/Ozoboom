import type { DeviceId, InputDevice, InputSnapshot } from '../input/intents';
import { freeClassId, isFreeClass } from '../shared/class-choice';
import { trimPlayerName } from '../shared/player-name';
import type { PlayerSlot } from '../sim/initial-state';
import { PLAYER_IDS, type PlayerId } from '../sim/state';
import { defaultName, type LobbyModel, type LobbySeat } from '../ui';

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

  const takenClasses = (except?: PlayerId) =>
    new Set(seats.filter((seat) => seat.playerId !== except).map((seat) => seat.classId));

  return {
    get count() {
      return seats.length;
    },
    join(device) {
      if (seats.length >= PLAYER_IDS.length || seats.some((seat) => seat.device === device)) {
        return false;
      }
      const playerId = PLAYER_IDS.find((id) => find(id) === undefined);
      if (playerId === undefined) {
        return false;
      }
      seats.push({
        playerId,
        device,
        name: defaultName(playerId),
        classId: freeClassId(classIds, takenClasses(), firstClassId),
      });
      return true;
    },
    leave(playerId) {
      const before = seats.length;
      seats = seats.filter((seat) => seat.playerId !== playerId);
      return seats.length < before;
    },
    setClass(playerId, classId) {
      const seat = find(playerId);
      if (seat !== undefined && isFreeClass(classIds, takenClasses(playerId), classId)) {
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
        const id = PLAYER_IDS[index];
        if (id !== undefined) {
          slots.push({ id, classId: seat.classId, name: seat.name });
          locals.set(id, seat.device);
        }
      }
      return { slots, locals };
    },
  };
}

// Who opens the lobby takes the first place: the device that confirms on this frame, else a click,
// which the frame does not see: the keyboard and mouse, unless the screen is played by touch, which
// has no place of its own.
export function openerOf(
  devices: ReadonlyMap<DeviceId, InputSnapshot>,
  merged: InputDevice,
): DeviceId | null {
  for (const [device, snapshot] of devices) {
    if (snapshot.menu.confirm) {
      return device;
    }
  }
  return merged === 'touch' ? null : 'keyboardMouse';
}

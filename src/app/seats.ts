import type { DeviceId, InputDevice, InputSnapshot } from '../input/intents';
import { freeClassId, isFreeClass } from '../shared/class-choice';
import type { PlayerSlot } from '../sim/initial-state';
import { PLAYER_IDS, type PlayerId } from '../sim/state';
import { defaultName, type PickerSeat } from '../ui';

interface Seat {
  playerId: PlayerId;
  device: DeviceId;
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
  // The same place, class and cursor, played from another device that has no place.
  handOver(playerId: PlayerId, device: DeviceId): boolean;
  setClass(playerId: PlayerId, classId: string): void;
  clear(): void;
  // In place order, the same list until a seat changes.
  list(): readonly PickerSeat[];
  // Players numbered 0 to n - 1 in seat order, as the sim wants them.
  launch(): LaunchedSeats;
}

// A newcomer gets the favourite class, read as they join, when nobody has it.
export function createSeats(classIds: readonly string[], favourite: () => string): Seats {
  let seats: Seat[] = [];
  // Read on every frame of the character screen: made again only when a seat changes.
  let listed: readonly Readonly<Seat>[] = [];

  const relist = () => {
    listed = [...seats]
      .sort((a, b) => a.playerId - b.playerId)
      .map(({ playerId, classId, device }) => ({ playerId, classId, device }));
  };
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
      seats.push({ playerId, device, classId: freeClassId(classIds, takenClasses(), favourite()) });
      relist();
      return true;
    },
    leave(playerId) {
      const before = seats.length;
      seats = seats.filter((seat) => seat.playerId !== playerId);
      relist();
      return seats.length < before;
    },
    handOver(playerId, device) {
      const seat = find(playerId);
      if (seat === undefined || seats.some((other) => other.device === device)) {
        return false;
      }
      seat.device = device;
      relist();
      return true;
    },
    setClass(playerId, classId) {
      const seat = find(playerId);
      if (seat !== undefined && isFreeClass(classIds, takenClasses(playerId), classId)) {
        seat.classId = classId;
        relist();
      }
    },
    clear() {
      seats = [];
      relist();
    },
    list() {
      return listed;
    },
    launch() {
      const slots: PlayerSlot[] = [];
      const locals = new Map<PlayerId, DeviceId>();
      for (const [index, seat] of listed.entries()) {
        const id = PLAYER_IDS[index];
        if (id !== undefined) {
          // The name of the place the seat sat in, not of the number it plays under.
          slots.push({ id, classId: seat.classId, name: defaultName(seat.playerId) });
          locals.set(id, seat.device);
        }
      }
      return { slots, locals };
    },
  };
}

// Who opens the flow before a game takes the first place: the device that confirms on this frame, else a click,
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

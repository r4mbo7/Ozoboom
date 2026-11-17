import type { DeviceId, InputSnapshot, MenuIntents } from '../input/intents';
import { PLAYER_IDS, type PlayerId } from '../sim/state';
import { stepClass } from './lobby-model';
import { type MenuInput, createMenuInput } from './navigation';
import type { PickerSeat, UiFrame } from './types';

function canTakeSeat(seats: readonly PickerSeat[], device: DeviceId): boolean {
  return seats.length < PLAYER_IDS.length && !seats.some((seat) => seat.device === device);
}

type ClassSeat = Pick<PickerSeat, 'playerId' | 'classId'>;

export function heldByOthers(seats: readonly ClassSeat[], seat: ClassSeat): Set<string> {
  return new Set(
    seats.filter((other) => other.playerId !== seat.playerId).map((other) => other.classId),
  );
}

// The next class along the list that no other seat holds, null when none is free.
export function stepFreeClass(
  classes: readonly { id: string }[],
  seats: readonly ClassSeat[],
  seat: ClassSeat,
  direction: -1 | 1,
): string | null {
  return stepClass(classes, seat.classId, direction, heldByOthers(seats, seat));
}

// The first seat of a gamepad no longer plugged, which leaves: the keyboard never unplugs.
export function unplugged(
  devices: UiFrame['devices'],
  seats: readonly PickerSeat[],
): PlayerId | null {
  if (devices === undefined) {
    return null;
  }
  const gone = seats.find(
    ({ device }) =>
      device !== null &&
      device !== 'keyboardMouse' &&
      !devices.some((plugged) => plugged.device === device),
  );
  return gone?.playerId ?? null;
}

// How long a device without a seat holds its confirm to join.
const HOLD_TO_JOIN_MS = 1000;

// What a device without a seat did on this frame. Beside a lone seat, a move takes over that seat,
// and a brief press takes it over and confirms once released; holding the confirm a second joins;
// beside two seats or none, a brief press or a move only knocks on the invite.
export interface Newcomer {
  readonly device: DeviceId;
  readonly does: 'takeOver' | 'join' | 'knock';
  // The presses of this frame, which the seat taken over plays: the confirm of a brief press too.
  readonly edges: MenuIntents;
}

function moves(edges: MenuIntents): boolean {
  return edges.up || edges.down || edges.left || edges.right;
}

// Each seat reads its own device, and each device without a seat can take one.
export interface SeatInputs {
  // A seat confirms once its confirm is let go of, as a device without a seat does, which a hold
  // would make join: the same press never acts on its way down here and on its way up there.
  edges(playerId: PlayerId, snapshot: InputSnapshot): MenuIntents;
  // The first device of the frame without a seat that did something, if a seat is free.
  newcomer(devices: UiFrame['devices'], seats: readonly PickerSeat[]): Newcomer | null;
  // How far, from 0 to 1, the longest hold to join of the last frame has gone.
  holdToJoin(): number;
  // The seat reads on from the device that takes it over, which holds what it pressed till released.
  handOver(playerId: PlayerId, device: DeviceId): void;
  // Forgets the seats that left: one that comes back waits for what it holds to be released.
  keep(seats: readonly PickerSeat[]): void;
  clear(): void;
}

// Made when a seat or a device shows: a key still held from before waits for its release.
function openedInput(): MenuInput {
  const input = createMenuInput();
  input.open();
  return input;
}

export function createSeatInputs(now: () => number): SeatInputs {
  const seatInputs = new Map<PlayerId, MenuInput>();
  const deviceInputs = new Map<DeviceId, MenuInput>();
  // When each device without a seat pressed the confirm it still holds.
  const holds = new Map<DeviceId, number>();
  // The seats whose confirm went down and is not let go of yet.
  const confirming = new Set<PlayerId>();
  let longestHold = 0;

  function inputOf<K>(inputs: Map<K, MenuInput>, key: K): MenuInput {
    let input = inputs.get(key);
    if (input === undefined) {
      input = openedInput();
      inputs.set(key, input);
    }
    return input;
  }

  return {
    edges(playerId, snapshot) {
      const edges = inputOf(seatInputs, playerId).edges(snapshot.menu, snapshot.gameplay.move);
      if (edges.confirm) {
        confirming.add(playerId);
      }
      const released = confirming.has(playerId) && !snapshot.confirmHeld;
      if (released) {
        confirming.delete(playerId);
      }
      return { ...edges, confirm: released };
    },
    newcomer(devices, seats) {
      const at = now();
      let found: Newcomer | null = null;
      longestHold = 0;
      for (const { device, snapshot } of devices ?? []) {
        let edges = inputOf(deviceInputs, device).edges(snapshot.menu, snapshot.gameplay.move);
        if (!canTakeSeat(seats, device)) {
          holds.delete(device);
          continue;
        }
        if (edges.confirm) {
          holds.set(device, at);
        }
        const since = holds.get(device);
        const brief = seats.length === 1 ? 'takeOver' : 'knock';
        let does: Newcomer['does'] | null = null;
        if (since === undefined) {
          does = moves(edges) ? brief : null;
        } else if (!snapshot.confirmHeld) {
          does = brief;
          edges = { ...edges, confirm: true };
        } else if (at - since >= HOLD_TO_JOIN_MS) {
          does = 'join';
        } else {
          longestHold = Math.max(longestHold, (at - since) / HOLD_TO_JOIN_MS);
        }
        if (does !== null) {
          holds.delete(device);
          found ??= { device, does, edges };
        }
      }
      return found;
    },
    holdToJoin: () => longestHold,
    handOver(playerId, device) {
      seatInputs.set(playerId, inputOf(deviceInputs, device));
      deviceInputs.delete(device);
      holds.delete(device);
      confirming.delete(playerId);
    },
    keep(seats) {
      for (const playerId of [...seatInputs.keys()]) {
        if (!seats.some((seat) => seat.playerId === playerId)) {
          seatInputs.delete(playerId);
          confirming.delete(playerId);
        }
      }
      for (const seat of seats) {
        inputOf(seatInputs, seat.playerId);
      }
    },
    clear() {
      seatInputs.clear();
      deviceInputs.clear();
      holds.clear();
      confirming.clear();
    },
  };
}

import type { MenuIntents } from '../input/intents';
import type { PlayerId } from '../sim/state';
import { heldByOthers, stepFreeClass } from './seat-input';
import type { PickerSeat } from './types';

// The last card when the row below is shorter; null past the first or the last row.
export function gridStep(
  count: number,
  columns: number,
  index: number,
  side: -1 | 1,
): number | null {
  const row = Math.floor(index / columns) + side;
  if (row < 0 || row > Math.floor((count - 1) / columns)) {
    return null;
  }
  return Math.min(index + side * columns, count - 1);
}

// A seat and what its own device pressed on this frame.
export interface DrivenSeat {
  readonly seat: PickerSeat;
  readonly edges: MenuIntents;
}

export interface ClassCursorActions {
  pick(playerId: PlayerId, classId: string): void;
  leaveSeat(playerId: PlayerId): void;
  launch(): void;
  // The first seat steps back out of the screen.
  back(): void;
}

// What the screen tells of its grid, and the row of buttons under it, which only the first seat walks.
export interface ClassGrid {
  columns(): number;
  inButtons(): boolean;
  // True when the presses were for the buttons.
  buttons(edges: MenuIntents): boolean;
}

// The first seat's cursor walks the buttons, the mouse clicks for its own seat.
export type LaunchPresser = 'cursor' | 'mouse';

export interface ClassCursors {
  // Nobody ready yet.
  open(): void;
  // The seats that left are no longer ready; alone, nobody waits. Once the one seat still
  // choosing leaves, the others launch.
  follow(seats: readonly PickerSeat[]): void;
  isReady(playerId: PlayerId): boolean;
  // The first seat not ready yet, null while one seat or none plays, or once all are.
  waiting(seats: readonly PickerSeat[]): PickerSeat | null;
  // True when a seat locked or unlocked its pick.
  update(driven: readonly DrivenSeat[]): boolean;
  // A click on a card, for the seat that plays with the mouse, if any.
  click(seats: readonly PickerSeat[], classId: string): void;
  // The seat not ready yet that a press on the launch button confirms, if any.
  presser(seats: readonly PickerSeat[], by: LaunchPresser): PickerSeat | null;
  // Confirms the presser's pick, as confirming on its card does.
  pressLaunch(seats: readonly PickerSeat[], by: LaunchPresser): void;
}

function mouseSeat(seats: readonly PickerSeat[]): PickerSeat | undefined {
  return seats.length < 2 ? seats[0] : seats.find((one) => one.device === 'keyboardMouse');
}

// Alone, a cursor picks and confirming launches. Together, each seat moves its own cursor at once,
// past the characters the others hold, confirming locks a seat's pick and the game launches once
// every seat is locked; back unlocks, then frees the seat, or steps back out for the first one.
export function createClassCursors(
  classes: readonly { id: string }[],
  grid: ClassGrid,
  actions: ClassCursorActions,
): ClassCursors {
  const ready = new Set<PlayerId>();

  // The seats of this frame, each move written at once: the next seat steps past it.
  function pick(seats: PickerSeat[], seat: PickerSeat, classId: string): void {
    actions.pick(seat.playerId, classId);
    const index = seats.findIndex((one) => one.playerId === seat.playerId);
    seats[index] = { ...seat, classId };
  }

  // Ready no more once launched: the screen shown again with the same seats does not launch twice.
  function launchOnceAllReady(seats: readonly PickerSeat[]): void {
    if (seats.every((other) => ready.has(other.playerId))) {
      ready.clear();
      actions.launch();
    }
  }

  function lock(seat: PickerSeat, seats: readonly PickerSeat[]): void {
    if (seats.length < 2) {
      actions.launch();
      return;
    }
    ready.add(seat.playerId);
    launchOnceAllReady(seats);
  }

  function presser(seats: readonly PickerSeat[], by: LaunchPresser): PickerSeat | null {
    const seat = by === 'cursor' ? seats[0] : mouseSeat(seats);
    return seat === undefined || ready.has(seat.playerId) ? null : seat;
  }

  // Up or down the column, past the cards other seats hold. False when the press leaves the grid
  // downwards, for the buttons.
  function stepColumn(seat: PickerSeat, seats: PickerSeat[], side: -1 | 1): boolean {
    const columns = grid.columns();
    if (columns >= classes.length) {
      return false;
    }
    const held = heldByOthers(seats, seat);
    let index: number | null = Math.max(
      classes.findIndex((entry) => entry.id === seat.classId),
      0,
    );
    do {
      index = gridStep(classes.length, columns, index, side);
    } while (index !== null && held.has(classes[index]?.id ?? ''));
    const next = index === null ? undefined : classes[index];
    if (next !== undefined) {
      pick(seats, seat, next.id);
      return true;
    }
    return side < 0;
  }

  // True when the screen must repaint; 'left' when the press changed who sits, which leaves the seats
  // the frame started with stale.
  function drive(seat: PickerSeat, edges: MenuIntents, seats: PickerSeat[]): boolean | 'left' {
    const first = seat.playerId === seats[0]?.playerId;
    if (ready.has(seat.playerId)) {
      if (edges.back) {
        ready.delete(seat.playerId);
        return true;
      }
      return false;
    }
    const vertical = edges.down ? 1 : edges.up ? -1 : 0;
    const onCards = !first || !grid.inButtons();
    if (onCards && vertical !== 0 && !edges.back && !edges.confirm) {
      if (stepColumn(seat, seats, vertical) || !first) {
        return false;
      }
    }
    if (first && grid.buttons(edges)) {
      return false;
    }
    const side = (edges.right ? 1 : 0) - (edges.left ? 1 : 0);
    const next = side === 0 ? null : stepFreeClass(classes, seats, seat, side > 0 ? 1 : -1);
    if (edges.back) {
      if (first || seats.length < 2) {
        actions.back();
      } else {
        actions.leaveSeat(seat.playerId);
      }
      return 'left';
    } else if (edges.confirm) {
      lock(seat, seats);
      return seats.length > 1;
    } else if (next !== null) {
      pick(seats, seat, next);
    }
    return false;
  }

  return {
    open() {
      ready.clear();
    },
    // A seat that left takes its « Prêt » with it; when every seat still there is ready, even one left
    // alone, the game starts.
    follow(seats) {
      for (const playerId of [...ready]) {
        if (!seats.some((seat) => seat.playerId === playerId)) {
          ready.delete(playerId);
        }
      }
      if (ready.size > 0) {
        launchOnceAllReady(seats);
      }
    },
    isReady: (playerId) => ready.has(playerId),
    waiting(seats) {
      return seats.length < 2 ? null : (seats.find((seat) => !ready.has(seat.playerId)) ?? null);
    },
    update(driven) {
      const seats = driven.map(({ seat }) => seat);
      let changed = false;
      for (const [index, { edges }] of driven.entries()) {
        const seat = seats[index];
        const result = seat === undefined ? false : drive(seat, edges, seats);
        // The other presses of this frame wait for the next one, on the seats as they are now.
        if (result === 'left') {
          return true;
        }
        changed = result || changed;
      }
      return changed;
    },
    click(seats, classId) {
      const seat = mouseSeat(seats);
      if (seat === undefined || ready.has(seat.playerId)) {
        return;
      }
      if (seat.classId === classId) {
        lock(seat, seats);
      } else if (!seats.some((other) => other.classId === classId)) {
        actions.pick(seat.playerId, classId);
      }
    },
    presser,
    pressLaunch(seats, by) {
      const seat = presser(seats, by);
      if (seat !== null) {
        lock(seat, seats);
      }
    },
  };
}

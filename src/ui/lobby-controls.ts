import type { DeviceId, InputSnapshot, MenuIntents } from '../input/intents';
import type { PlayerId } from '../sim/state';
import {
  type Row,
  canTakeSeat,
  deviceOf,
  lobbyView,
  ownSeat,
  rowsOf,
  seatAt,
  seatRows,
  stepClass,
  stepRow,
} from './lobby-model';
import { type MenuInput, createMenuInput } from './navigation';
import type { NightTabs } from './night';
import { stepStage } from './stage';
import type { LobbyModel, LobbySeat, UiFrame } from './types';

export interface LobbyControlActions {
  joinSeat(device: DeviceId): void;
  leaveSeat(playerId: PlayerId): void;
  seatClass(playerId: PlayerId, classId: string): void;
  chooseStage(setId: string): void;
  leave(): void;
}

export interface LobbyControlsSetup {
  readonly current: () => LobbyModel;
  readonly actions: LobbyControlActions;
  readonly classes: readonly { id: string }[];
  readonly nights: Pick<NightTabs, 'handle'>;
  readonly activate: (row: Row, seat: LobbySeat | null) => void;
}

export interface LitRow {
  readonly row: Row;
  readonly seat: LobbySeat | null;
}

export interface CursorMarks {
  readonly lit: readonly LitRow[];
  readonly quiet: ReadonlySet<PlayerId>;
}

export interface LobbyControls {
  open(): void;
  follow(): void;
  hover(row: Row): boolean;
  marks(typing: PlayerId | undefined): CursorMarks;
  stepChoice(seat: LobbySeat | null, row: Row | undefined, direction: -1 | 1): void;
  update(frame: UiFrame, edges: MenuIntents): void;
}

// Made when a seat or a device shows: a key still held from before waits for its release.
function openedInput(): MenuInput {
  const input = createMenuInput();
  input.open();
  return input;
}

// Online, one cursor for the one device of this screen; locally, one cursor per seat.
export function createLobbyControls(setup: LobbyControlsSetup): LobbyControls {
  const { current, actions, classes, nights, activate } = setup;
  let cursor = 0;
  let cursorView = lobbyView(current());
  const seatCursors = new Map<PlayerId, number>();
  let activeSeat: PlayerId | null = null;
  const seatInputs = new Map<PlayerId, MenuInput>();
  const deviceInputs = new Map<DeviceId, MenuInput>();

  function stepChoice(seat: LobbySeat | null, row: Row | undefined, direction: -1 | 1): void {
    if (row === 'stage') {
      const model = current();
      const next = stepStage(model.stages ?? [], model.stageId ?? '', direction);
      if (next !== null) {
        actions.chooseStage(next);
      }
      return;
    }
    if (seat === null || row !== 'class') {
      return;
    }
    const next = stepClass(classes, seat.classId, direction);
    if (next !== null) {
      actions.seatClass(seat.playerId, next);
    }
  }

  function seatInput(playerId: PlayerId): MenuInput {
    let input = seatInputs.get(playerId);
    if (input === undefined) {
      input = openedInput();
      seatInputs.set(playerId, input);
    }
    return input;
  }

  function updateOnline(edges: MenuIntents): void {
    if (lobbyView(current()) !== 'entry' && nights.handle(edges)) {
      return;
    }
    const rows = rowsOf(current());
    const step = stepRow(rows.length, Math.min(cursor, rows.length - 1), edges);
    const row = rows[step.index];
    if (step.side !== 0) {
      stepChoice(ownSeat(current()), row, step.side);
    }
    cursor = step.index;
    if (step.back) {
      actions.leave();
    } else if (step.confirmed && row !== undefined) {
      activate(row, ownSeat(current()));
    }
  }

  function driveSeat(seat: LobbySeat, snapshot: InputSnapshot): boolean {
    const own = seatInput(seat.playerId).edges(snapshot.menu, snapshot.gameplay.move);
    if (Object.values(own).some(Boolean)) {
      activeSeat = seat.playerId;
    }
    if (seat.host && nights.handle(own)) {
      return false;
    }
    const rows = seatRows(seat, current());
    const step = stepRow(rows.length, seatCursors.get(seat.playerId) ?? 0, own);
    const row = rows[step.index];
    seatCursors.set(seat.playerId, step.index);
    if (step.side !== 0) {
      stepChoice(seat, row, step.side);
    }
    if (step.back) {
      actions.leaveSeat(seat.playerId);
      return true;
    }
    if (step.confirmed && row !== undefined) {
      activate(row, seat);
      return true;
    }
    return false;
  }

  function driveSeats(frame: UiFrame): boolean {
    let acted = false;
    for (const seat of current().seats) {
      const player = frame.players.find((entry) => entry.playerId === seat.playerId);
      if (!seat.remote && player !== undefined && driveSeat(seat, player.snapshot)) {
        acted = true;
      }
    }
    return acted;
  }

  function joinByDevice(devices: NonNullable<UiFrame['devices']>): void {
    for (const { device, snapshot } of devices) {
      let input = deviceInputs.get(device);
      if (input === undefined) {
        input = openedInput();
        deviceInputs.set(device, input);
      }
      const pressed = input.edges(snapshot.menu, snapshot.gameplay.move).confirm;
      if (pressed && canTakeSeat(current(), device)) {
        actions.joinSeat(device);
        break;
      }
    }
  }

  function updateLocal(frame: UiFrame, edges: MenuIntents): void {
    if (driveSeats(frame)) {
      return;
    }
    if (edges.back && current().seats.length === 0) {
      actions.leave();
    } else if (frame.devices !== undefined) {
      joinByDevice(frame.devices);
    } else if (edges.confirm) {
      const taker = deviceOf(frame.snapshot.device);
      if (taker !== null && canTakeSeat(current(), taker)) {
        actions.joinSeat(taker);
      }
    }
  }

  return {
    open() {
      cursor = 0;
      seatCursors.clear();
      seatInputs.clear();
      deviceInputs.clear();
    },
    follow() {
      const model = current();
      const view = lobbyView(model);
      if (view !== cursorView) {
        cursorView = view;
        cursor = 0;
      }
      cursor = Math.min(cursor, Math.max(rowsOf(model).length - 1, 0));
      for (const playerId of [...seatCursors.keys()]) {
        if (seatAt(model, playerId) === null) {
          seatCursors.delete(playerId);
          seatInputs.delete(playerId);
        }
      }
      for (const seat of model.seats) {
        if (!seat.remote) {
          seatInput(seat.playerId);
        }
      }
    },
    hover(row) {
      const model = current();
      if (model.mode !== 'online') {
        return false;
      }
      const index = rowsOf(model).indexOf(row);
      if (index < 0 || index === cursor) {
        return false;
      }
      cursor = index;
      return true;
    },
    marks(typing) {
      const model = current();
      if (model.mode !== 'local') {
        const row = rowsOf(model)[cursor];
        return {
          lit: row === undefined ? [] : [{ row, seat: ownSeat(model) }],
          quiet: new Set(),
        };
      }
      const lead = typing ?? activeSeat ?? model.seats[0]?.playerId;
      const lit = model.seats.flatMap((seat) => {
        const row = seatRows(seat, model)[seatCursors.get(seat.playerId) ?? 0];
        return row === undefined ? [] : [{ row, seat }];
      });
      const others = model.seats.filter((seat) => seat.playerId !== lead);
      return {
        lit,
        quiet: new Set(model.seats.length > 1 ? others.map((seat) => seat.playerId) : []),
      };
    },
    stepChoice,
    update(frame, edges) {
      if (lobbyView(current()) === 'local') {
        updateLocal(frame, edges);
      } else {
        updateOnline(edges);
      }
    },
  };
}

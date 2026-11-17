import type { MenuIntents } from '../input/intents';
import type { PlayerId } from '../sim/state';
import { type Row, lobbyView, ownSeat, rowsOf, stepRow } from './lobby-model';
import type { NightTabs } from './night';
import { stepFreeClass } from './seat-input';
import { stepStage } from './stage';
import type { LobbyModel, LobbySeat } from './types';

export interface LobbyControlActions {
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

export interface LobbyControls {
  open(): void;
  follow(): void;
  hover(row: Row): boolean;
  lit(): LitRow | null;
  stepChoice(seat: LobbySeat | null, row: Row | undefined, direction: -1 | 1): void;
  update(edges: MenuIntents): void;
}

// One cursor, for the one device of this screen.
export function createLobbyControls(setup: LobbyControlsSetup): LobbyControls {
  const { current, actions, classes, nights, activate } = setup;
  let cursor = 0;
  let cursorView = lobbyView(current());

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
    const next = stepFreeClass(classes, current().seats, seat, direction);
    if (next !== null) {
      actions.seatClass(seat.playerId, next);
    }
  }

  return {
    open() {
      cursor = 0;
    },
    follow() {
      const model = current();
      const view = lobbyView(model);
      if (view !== cursorView) {
        cursorView = view;
        cursor = 0;
      }
      cursor = Math.min(cursor, Math.max(rowsOf(model).length - 1, 0));
    },
    hover(row) {
      const index = rowsOf(current()).indexOf(row);
      if (index < 0 || index === cursor) {
        return false;
      }
      cursor = index;
      return true;
    },
    lit() {
      const model = current();
      const row = rowsOf(model)[cursor];
      return row === undefined ? null : { row, seat: ownSeat(model) };
    },
    stepChoice,
    update(edges) {
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
    },
  };
}

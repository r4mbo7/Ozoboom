import type { ClassPickerActions } from './class-screen';
import type { LobbyActions } from './lobby';
import type { MenuInput } from './navigation';
import type { ShownScreen } from './shown-screen';
import type { StagePickerActions } from './stage';
import type { TitleActions } from './title';
import type { TitleOptionActions } from './title-options';
import type { UiCallbacks } from './types';

type Once = Pick<ShownScreen, 'once'>;

export function titleActions(
  callbacks: Pick<
    UiCallbacks,
    'onStart' | 'onPlayTogether' | 'onPlayOnline' | 'onControls' | 'onChooseLocale'
  >,
  shown: Once,
  options: TitleOptionActions,
  menuInput: Pick<MenuInput, 'open'>,
  feedback: (() => void) | undefined,
): TitleActions {
  return {
    ...(feedback === undefined ? {} : { feedback }),
    ...options,
    start: shown.once(() => {
      callbacks.onStart();
    }),
    playTogether() {
      callbacks.onPlayTogether();
    },
    playOnline() {
      callbacks.onPlayOnline();
    },
    controls() {
      menuInput.open();
      callbacks.onControls();
    },
    chooseLocale(next) {
      callbacks.onChooseLocale(next);
    },
  };
}

export function classActions(
  callbacks: Pick<
    UiCallbacks,
    'onChooseClass' | 'onToggleEndless' | 'onConfirmClass' | 'onLeaveClassPicker'
  >,
  shown: Once,
): ClassPickerActions {
  return {
    choose(classId) {
      callbacks.onChooseClass(classId);
    },
    toggleEndless(enabled) {
      callbacks.onToggleEndless(enabled);
    },
    confirm: shown.once(() => {
      callbacks.onConfirmClass();
    }),
    leave: shown.once(() => {
      callbacks.onLeaveClassPicker();
    }),
  };
}

export function stageActions(
  callbacks: Pick<
    UiCallbacks,
    'onChooseStage' | 'onChooseNight' | 'onConfirmStage' | 'onLeaveStagePicker'
  >,
  shown: Once,
): StagePickerActions {
  return {
    choose(setId) {
      callbacks.onChooseStage(setId);
    },
    chooseNight(night) {
      callbacks.onChooseNight(night);
    },
    confirm: shown.once(() => {
      callbacks.onConfirmStage();
    }),
    leave: shown.once(() => {
      callbacks.onLeaveStagePicker();
    }),
  };
}

export function lobbyActions(
  callbacks: Pick<
    UiCallbacks,
    | 'onJoinSeat'
    | 'onLeaveSeat'
    | 'onSeatClass'
    | 'onSeatName'
    | 'onChooseStage'
    | 'onChooseNight'
    | 'onCreateRoom'
    | 'onJoinRoom'
    | 'onLaunch'
    | 'onLeaveLobby'
  >,
  shown: Once,
): LobbyActions {
  return {
    joinSeat(device) {
      callbacks.onJoinSeat(device);
    },
    leaveSeat(playerId) {
      callbacks.onLeaveSeat(playerId);
    },
    seatClass(playerId, classId) {
      callbacks.onSeatClass(playerId, classId);
    },
    seatName(playerId, name) {
      callbacks.onSeatName(playerId, name);
    },
    chooseStage(setId) {
      callbacks.onChooseStage(setId);
    },
    chooseNight(night) {
      callbacks.onChooseNight(night);
    },
    createRoom() {
      callbacks.onCreateRoom();
    },
    joinRoom(code) {
      callbacks.onJoinRoom(code);
    },
    launch: shown.once(() => {
      callbacks.onLaunch();
    }),
    leave: shown.once(() => {
      callbacks.onLeaveLobby();
    }),
  };
}

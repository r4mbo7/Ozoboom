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
    | 'onStart'
    | 'onPlayOnline'
    | 'onControls'
    | 'onChooseLocale'
    | 'onChangelogOpened'
    | 'onLeaderboardOpened'
  >,
  shown: Once,
  options: TitleOptionActions,
  menuInput: Pick<MenuInput, 'open'>,
  feedback: (() => void) | undefined,
  programme: () => void,
): TitleActions {
  return {
    ...(feedback === undefined ? {} : { feedback }),
    ...options,
    programme,
    start: shown.once(() => {
      callbacks.onStart();
    }),
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
    changelogOpened() {
      callbacks.onChangelogOpened();
    },
    ...(callbacks.onLeaderboardOpened === undefined
      ? {}
      : {
          leaderboardOpened() {
            callbacks.onLeaderboardOpened?.();
          },
        }),
  };
}

export function classActions(
  callbacks: Pick<
    UiCallbacks,
    | 'onChooseClass'
    | 'onSeatClass'
    | 'onJoinSeat'
    | 'onLeaveSeat'
    | 'onHandOverSeat'
    | 'onToggleEndless'
    | 'onConfirmClass'
    | 'onLearn'
    | 'onLeaveClassPicker'
  >,
  shown: Once,
): ClassPickerActions {
  return {
    choose(classId) {
      callbacks.onChooseClass(classId);
    },
    seatClass(playerId, classId) {
      callbacks.onSeatClass(playerId, classId);
    },
    joinSeat(device) {
      callbacks.onJoinSeat(device);
    },
    leaveSeat(playerId) {
      callbacks.onLeaveSeat(playerId);
    },
    handOverSeat(playerId, device) {
      callbacks.onHandOverSeat(playerId, device);
    },
    toggleEndless(enabled) {
      callbacks.onToggleEndless(enabled);
    },
    confirm: shown.once(() => {
      callbacks.onConfirmClass();
    }),
    learn: shown.once(() => {
      callbacks.onLearn();
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
    seatClass(playerId, classId) {
      callbacks.onSeatClass(playerId, classId);
    },
    seatName(name) {
      callbacks.onSeatName(name);
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

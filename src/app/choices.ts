import type { AudioEngine } from '../audio/types';
import type { UiCallbacks } from '../ui/types';
import type { Online } from './online';
import type { LaunchedSeats, Seats } from './seats';
import type { Settings } from './settings';
import type { Screen } from './sound';

export type Room = Pick<
  Online,
  | 'role'
  | 'setSeatClass'
  | 'setSeatName'
  | 'createRoom'
  | 'joinRoom'
  | 'launch'
  | 'setStage'
  | 'setNight'
>;

export interface ChoicesEnv {
  readonly seats: Seats;
  readonly audio: Pick<AudioEngine, 'cue' | 'start'>;
  readonly settings: Pick<Settings, 'prefs' | 'remember'>;
  readonly setIds: readonly string[];
  room(): Room;
  inRoom(): boolean;
  screen(): Screen;
  pickStage(setId: string): void;
  showLobby(): void;
  showStagePicker(): void;
  showClassPicker(): void;
  launch(seated: LaunchedSeats): void;
}

export type ChoiceCallbacks = Pick<
  UiCallbacks,
  | 'onJoinSeat'
  | 'onLeaveSeat'
  | 'onSeatClass'
  | 'onSeatName'
  | 'onCreateRoom'
  | 'onJoinRoom'
  | 'onLaunch'
  | 'onChooseStage'
  | 'onToggleEndless'
  | 'onChooseNight'
>;

export function choiceCallbacks(env: ChoicesEnv): ChoiceCallbacks {
  const { seats, audio, settings } = env;
  const { prefs } = settings;

  function showChoice(tellRoom: (room: Room) => void): void {
    if (env.screen() === 'stage') {
      env.showStagePicker();
    } else if (env.inRoom()) {
      tellRoom(env.room());
    } else {
      env.showLobby();
    }
  }

  function guestInRoom(): boolean {
    return env.inRoom() && env.room().role !== 'host';
  }

  return {
    onJoinSeat(device) {
      if (seats.join(device)) {
        audio.cue('seatTaken');
        env.showLobby();
      }
    },
    onLeaveSeat(playerId) {
      if (seats.leave(playerId)) {
        audio.cue('seatFreed');
        env.showLobby();
      }
    },
    onSeatClass(playerId, classId) {
      if (env.inRoom()) {
        void audio.start();
        env.room().setSeatClass(classId);
        return;
      }
      seats.setClass(playerId, classId);
      env.showLobby();
    },
    onSeatName(playerId, name) {
      if (env.inRoom()) {
        env.room().setSeatName(name);
        return;
      }
      seats.setName(playerId, name);
      env.showLobby();
    },
    onCreateRoom() {
      void audio.start();
      env.room().createRoom();
    },
    onJoinRoom(code) {
      void audio.start();
      env.room().joinRoom(code);
    },
    onLaunch() {
      if (env.inRoom()) {
        void audio.start();
        env.room().launch();
      } else if (seats.count > 0) {
        env.launch(seats.launch());
      }
    },
    onChooseStage(setId) {
      if (!env.setIds.includes(setId)) {
        return;
      }
      env.pickStage(setId);
      showChoice((room) => {
        room.setStage(setId);
      });
    },
    onToggleEndless(enabled) {
      if (guestInRoom()) {
        return;
      }
      settings.remember('endless', enabled);
      if (env.screen() === 'class') {
        env.showClassPicker();
      } else {
        showChoice((room) => {
          room.setNight(enabled, false);
        });
      }
    },
    onChooseNight(night) {
      if (guestInRoom()) {
        return;
      }
      settings.remember('endless', night === 'endless');
      settings.remember('festival', night === 'festival');
      showChoice((room) => {
        room.setNight(prefs.endless, prefs.festival);
      });
    },
  };
}

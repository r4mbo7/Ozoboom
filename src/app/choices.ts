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
  showStagePicker(): void;
  showClassPicker(): void;
  launch(seated: LaunchedSeats): void;
  // Solo: the merged input, the class remembered, no name.
  playAlone(): void;
}

export type ChoiceCallbacks = Pick<
  UiCallbacks,
  | 'onJoinSeat'
  | 'onLeaveSeat'
  | 'onHandOverSeat'
  | 'onSeatClass'
  | 'onSeatName'
  | 'onCreateRoom'
  | 'onJoinRoom'
  | 'onLaunch'
  | 'onConfirmClass'
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
      env.showClassPicker();
    }
  }

  // The class of the only seat is the one solo plays, and the next newcomer's favourite: its pick
  // while others sat beside it included.
  function rememberAlone(): void {
    const [alone, ...others] = seats.list();
    if (alone !== undefined && others.length === 0) {
      settings.remember('classId', alone.classId);
    }
  }

  function guestInRoom(): boolean {
    return env.inRoom() && env.room().role !== 'host';
  }

  return {
    onJoinSeat(device) {
      if (seats.join(device)) {
        audio.cue('seatTaken');
        env.showClassPicker();
      }
    },
    onLeaveSeat(playerId) {
      if (seats.leave(playerId)) {
        audio.cue('seatFreed');
        env.showClassPicker();
      }
    },
    onHandOverSeat(playerId, device) {
      if (seats.handOver(playerId, device)) {
        env.showClassPicker();
      }
    },
    onSeatClass(playerId, classId) {
      if (env.inRoom()) {
        void audio.start();
        env.room().setSeatClass(classId);
        return;
      }
      seats.setClass(playerId, classId);
      rememberAlone();
      env.showClassPicker();
    },
    onSeatName(name) {
      settings.remember('pseudo', name);
      env.room().setSeatName(name);
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
      void audio.start();
      env.room().launch();
    },
    // One player, or none on a touch screen, plays as solo plays; two or more play together.
    onConfirmClass() {
      if (seats.count > 1) {
        env.launch(seats.launch());
      } else {
        rememberAlone();
        env.playAlone();
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

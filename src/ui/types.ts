import type { DecorId, GameContent } from '../data/types';
import type { DeviceId, InputDevice, InputSnapshot } from '../input/intents';
import type { PlayerId, SimState } from '../sim/state';

export interface LocalPlayer {
  playerId: PlayerId;
  snapshot: InputSnapshot;
}

export interface UiFrame {
  snapshot: InputSnapshot;
  players: readonly LocalPlayer[];
  // Every active device with its id: the lobby lets each one without a seat take one.
  devices?: readonly { device: DeviceId; snapshot: InputSnapshot }[];
}

export interface StageCard {
  setId: string;
  name: string;
  style: string;
  bpm: number;
  decor: DecorId;
}

export interface StagePickerModel {
  stages: readonly StageCard[];
  stageId: string;
}

// Solo: the class picked, and whether confirming launches the set or leads to the scene.
export interface ClassPickerModel {
  classId: string;
  launches: boolean;
}

// A class drawn alive by the game: the ui places it, the app makes it (the ui cannot draw the game).
export interface ClassPortrait {
  readonly element: HTMLElement;
  setClass(classId: string): void;
  destroy(): void;
}

export type CreatePortrait = () => ClassPortrait;

export interface LobbySeat {
  playerId: PlayerId;
  name: string;
  classId: string;
  device: DeviceId | null;
  remote: boolean;
  host: boolean;
}

export interface LobbyModel {
  mode: 'local' | 'online';
  role: 'host' | 'guest';
  code: string | null;
  link: string | null;
  seats: readonly LobbySeat[];
  canLaunch: boolean;
  error: string | null;
  // The scenes to pick from and the one picked; only the host can change it.
  stages?: readonly StageCard[];
  stageId?: string;
}

export type Notice = 'desync' | 'hostLeft' | 'connectionLost';

// Online, who ends the game: only the host restarts it. Absent, the game is local.
export interface EndSession {
  role: 'host' | 'guest';
}

export interface UiCallbacks {
  onStart(): void;
  onRestart(): void;
  onQuit(): void;
  onChooseUpgrade(playerId: PlayerId, upgradeId: string): void;
  onToggleCalmMode(enabled: boolean): void;
  onToggleMute(muted: boolean): void;
  // From 1 to `VOLUME_STEPS`.
  onSetVolume(volume: number): void;
  onToggleAutoFire(enabled: boolean): void;
  onToggleAutoAim(enabled: boolean): void;
  onPlayTogether(): void;
  // Picks a class, in the class picker.
  onChooseClass(classId: string): void;
  // Solo: validates the picked class.
  onConfirmClass(): void;
  onLeaveClassPicker(): void;
  onJoinSeat(device: DeviceId): void;
  onLeaveSeat(playerId: PlayerId): void;
  onSeatClass(playerId: PlayerId, classId: string): void;
  onSeatName(playerId: PlayerId, name: string): void;
  // Only shows « Jouer en ligne » in the local lobby when set.
  onGoOnline?(): void;
  onCreateRoom(): void;
  onJoinRoom(code: string): void;
  // Picks a scene, in the picker or in the lobby.
  onChooseStage(setId: string): void;
  // Solo: validates the picked scene.
  onConfirmStage(): void;
  // Solo: back to the class picker.
  onLeaveStagePicker(): void;
  onLaunch(): void;
  onLeaveLobby(): void;
  onLeaveNotice(): void;
  // Only shows the « Ton avis » button when set. Route menu intents to the form until it closes.
  // `details` is what an interruption reports (the tick of a divergence): it prefills the form.
  onFeedback?(details?: string): void;
}

export interface Ui {
  showTitle(options: {
    calmMode: boolean;
    muted: boolean;
    volume: number;
    autoFire: boolean;
    autoAim: boolean;
    device: InputDevice;
  }): void;
  showClassPicker(model: ClassPickerModel): void;
  showVisits(count: number): void;
  showStagePicker(model: StagePickerModel): void;
  showLobby(model: LobbyModel): void;
  updateLobby(model: LobbyModel): void;
  showNotice(notice: Notice, details: string): void;
  showGame(): void;
  showEnd(state: SimState, session?: EndSession): void;
  update(state: SimState, frame: UiFrame, content: GameContent): void;
  destroy(): void;
}

export type CreateUi = (root: HTMLElement, callbacks: UiCallbacks) => Ui;

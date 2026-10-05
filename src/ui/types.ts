import type { GameContent } from '../data/types';
import type { DeviceId, InputDevice, InputSnapshot } from '../input/intents';
import type { PlayerId, SimState } from '../sim/state';

export interface LocalPlayer {
  playerId: PlayerId;
  snapshot: InputSnapshot;
}

export interface UiFrame {
  snapshot: InputSnapshot;
  players: readonly LocalPlayer[];
}

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
}

export type Notice = 'desync' | 'hostLeft' | 'connectionLost';

export interface UiCallbacks {
  onStart(): void;
  onRestart(): void;
  onChooseUpgrade(playerId: PlayerId, upgradeId: string): void;
  onToggleCalmMode(enabled: boolean): void;
  onToggleMute(muted: boolean): void;
  onPlayTogether(): void;
  onChooseClass(classId: string): void;
  onJoinSeat(device: DeviceId): void;
  onLeaveSeat(playerId: PlayerId): void;
  onSeatClass(playerId: PlayerId, classId: string): void;
  onSeatName(playerId: PlayerId, name: string): void;
  onCreateRoom(): void;
  onJoinRoom(code: string): void;
  onLaunch(): void;
  onLeaveLobby(): void;
  onLeaveNotice(): void;
  // Only shows the « Ton avis » button when set. Route menu intents to the form until it closes.
  onFeedback?(): void;
}

export interface Ui {
  showTitle(options: {
    calmMode: boolean;
    muted: boolean;
    device: InputDevice;
    classId: string;
  }): void;
  showLobby(model: LobbyModel): void;
  updateLobby(model: LobbyModel): void;
  showNotice(notice: Notice, details: string): void;
  showGame(): void;
  showEnd(state: SimState): void;
  update(state: SimState, frame: UiFrame, content: GameContent): void;
  destroy(): void;
}

export type CreateUi = (root: HTMLElement, callbacks: UiCallbacks) => Ui;

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
  // Every active device with its id: the lobby lets each one without a seat take one.
  devices?: readonly { device: DeviceId; snapshot: InputSnapshot }[];
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
  onToggleAutoFire(enabled: boolean): void;
  onToggleAutoAim(enabled: boolean): void;
  onPlayTogether(): void;
  onChooseClass(classId: string): void;
  onJoinSeat(device: DeviceId): void;
  onLeaveSeat(playerId: PlayerId): void;
  onSeatClass(playerId: PlayerId, classId: string): void;
  onSeatName(playerId: PlayerId, name: string): void;
  // Only shows « Jouer en ligne » in the local lobby when set.
  onGoOnline?(): void;
  onCreateRoom(): void;
  onJoinRoom(code: string): void;
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
    autoFire: boolean;
    autoAim: boolean;
    device: InputDevice;
    classId: string;
  }): void;
  showVisits(count: number): void;
  showLobby(model: LobbyModel): void;
  updateLobby(model: LobbyModel): void;
  showNotice(notice: Notice, details: string): void;
  showGame(): void;
  showEnd(state: SimState, session?: EndSession): void;
  update(state: SimState, frame: UiFrame, content: GameContent): void;
  destroy(): void;
}

export type CreateUi = (root: HTMLElement, callbacks: UiCallbacks) => Ui;

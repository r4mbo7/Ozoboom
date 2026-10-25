import type { DecorId, GameContent } from '../data/types';
import type { Locale } from '../shared/i18n';
import type { DeviceId, InputDevice, InputSnapshot } from '../input/intents';
import type { PlayerId, SimState } from '../sim/state';

export interface LocalPlayer {
  playerId: PlayerId;
  snapshot: InputSnapshot;
}

export interface UiFrame {
  snapshot: InputSnapshot;
  players: readonly LocalPlayer[];
  // The lobby lets each device without a seat take one.
  devices?: readonly { device: DeviceId; snapshot: InputSnapshot }[];
  // In eighths since the first note of the menu ambience; absent or null while it is silent.
  menuPosition?: number | null;
}

export interface StageCard {
  setId: string;
  name: string;
  style: string;
  bpm: number;
  decor: DecorId;
  // About how long its set lasts, in whole minutes.
  minutes: number;
}

// One stage played to its sunrise, one that goes on past its last boss, or the whole Full festival.
export type Night = 'stage' | 'endless' | 'festival';

export interface StagePickerModel {
  stages: readonly StageCard[];
  stageId: string;
  // The set goes on past its last boss.
  endless: boolean;
  // The whole festival, from the stage picked.
  festival?: boolean;
}

// Solo: confirming launches the set, or leads to the scene picker.
export interface ClassPickerModel {
  classId: string;
  launches: boolean;
  // Only asked where confirming launches.
  endless: boolean;
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
  // Empty when the player typed none: the lobby shows `defaultName` in the screen's language.
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
  // Only the host can change the stage, the endless set and the festival.
  stages?: readonly StageCard[];
  stageId?: string;
  endless?: boolean;
  festival?: boolean;
}

export type Notice = 'desync' | 'hostLeft' | 'connectionLost';

// Online, who ends the game: only the host restarts it. Absent, the game is local.
export interface EndSession {
  role: 'host' | 'guest';
}

// Played when the menu shows what the sound tells.
export type UpgradeCue =
  | 'cardDealt'
  | 'cardsReady'
  | 'cardRare'
  | 'cardLegendary'
  | 'upgradeChosen'
  | 'mateChose'
  | 'cardFlight'
  | 'cardLanded';

export interface UiCallbacks {
  onStart(): void;
  onRestart(): void;
  onQuit(): void;
  onChooseUpgrade(playerId: PlayerId, upgradeId: string): void;
  // The variant is the turn of a dealt card, 0 for the other cues.
  onUpgradeCue?(cue: UpgradeCue, variant: number): void;
  // Plays a circus weapon in the canvas of its card, until the returned function is called.
  onShowWeapon?(
    canvas: HTMLCanvasElement,
    weaponId: string,
    playerId: PlayerId,
  ): (() => void) | null;
  onToggleCalmMode(enabled: boolean): void;
  onToggleMute(muted: boolean): void;
  // From 1 to `VOLUME_STEPS`.
  onSetVolume(volume: number): void;
  onToggleHitSound(enabled: boolean): void;
  onToggleAutoFire(enabled: boolean): void;
  onToggleAutoAim(enabled: boolean): void;
  // The game reloads in it (ADR 0017).
  onChooseLocale(locale: Locale): void;
  onPlayTogether(): void;
  onPlayOnline(): void;
  onChooseClass(classId: string): void;
  // Solo only.
  onConfirmClass(): void;
  onLeaveClassPicker(): void;
  onJoinSeat(device: DeviceId): void;
  onLeaveSeat(playerId: PlayerId): void;
  onSeatClass(playerId: PlayerId, classId: string): void;
  onSeatName(playerId: PlayerId, name: string): void;
  onCreateRoom(): void;
  onJoinRoom(code: string): void;
  onChooseStage(setId: string): void;
  onToggleEndless(enabled: boolean): void;
  onChooseNight(night: Night): void;
  // Solo only.
  onConfirmStage(): void;
  // Solo: back to the class picker.
  onLeaveStagePicker(): void;
  onLaunch(): void;
  onLeaveLobby(): void;
  onLeaveNotice(): void;
  // Set, it shows « Ton avis » and takes the menu intents until the form closes; `details` prefills it.
  onFeedback?(details?: string): void;
  // Menu intents go to the keys screen until it closes.
  onControls(): void;
}

export interface Ui {
  showTitle(options: {
    calmMode: boolean;
    muted: boolean;
    volume: number;
    hitSound: boolean;
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

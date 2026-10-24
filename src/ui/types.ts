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
  // Every active device with its id: the lobby lets each one without a seat take one.
  devices?: readonly { device: DeviceId; snapshot: InputSnapshot }[];
  // The menu ambience as heard, in eighths since its first note; absent or null while it is silent.
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
  // Whether the set goes on past its last boss.
  endless: boolean;
  // Whether the game plays the whole festival from the stage picked.
  festival?: boolean;
}

// Solo: the class picked, and whether confirming launches the set or leads to the scene.
export interface ClassPickerModel {
  classId: string;
  launches: boolean;
  // Whether the set goes on past its last boss: only asked where confirming launches.
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
  // The scenes to pick from and the one picked; only the host can change it.
  stages?: readonly StageCard[];
  stageId?: string;
  // Whether the set goes on past its last boss; only the host can change it.
  endless?: boolean;
  // Whether the game plays the whole festival; only the host can change it.
  festival?: boolean;
}

export type Notice = 'desync' | 'hostLeft' | 'connectionLost';

// Online, who ends the game: only the host restarts it. Absent, the game is local.
export interface EndSession {
  role: 'host' | 'guest';
}

// A sound of the upgrade menu, played when the menu shows what it tells.
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
  // Whether the next set goes on past its last boss, wherever a set is launched from.
  onToggleEndless(enabled: boolean): void;
  // Which night the next game plays, from the stage picker or the lobby.
  onChooseNight(night: Night): void;
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
  // Opens the screen that changes the keys: menu intents go to it until it closes.
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

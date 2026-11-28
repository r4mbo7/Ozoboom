import type { DecorId, GameContent } from '../data/types';
import type { Locale } from '../shared/i18n';
import type { MenuHeard } from '../shared/menu-score';
import type { DeviceId, InputDevice, InputSnapshot } from '../input/intents';
import type { EntityId, PlayerId, SimState, Vec2 } from '../sim/state';
import type { TutorialStep } from './tutorial';
import type { SoundBus, SoundLevel, SoundMix } from './volume';

export interface LocalPlayer {
  playerId: PlayerId;
  snapshot: InputSnapshot;
}

export interface UiFrame {
  snapshot: InputSnapshot;
  players: readonly LocalPlayer[];
  // The lobby lets each device without a seat take one.
  devices?: readonly { device: DeviceId; snapshot: InputSnapshot }[];
  // What the menus play as it is heard; absent or null while they are silent.
  menuPosition?: MenuHeard | null;
  // Where a point of the arena shows, in pixels of the game's view.
  toScreen?: (point: Vec2) => Vec2;
  // The page time (`performance.now`) of the beat the game resumes on, its cards answered, while it
  // waits for it; absent or null when it resumes at once.
  resumesAt?: number | null;
  // The entry the run opens on, a bar past its landing; absent or null otherwise.
  entry?: EntryPoster | null;
}

// The two bars a run opens on, in page milliseconds (`performance.now`), its line-up poster, and what
// the poster names: the track and the stage, by their source names.
export interface EntryPoster {
  readonly startsAt: number;
  readonly beatMs: number;
  readonly landsAt: number;
  readonly poster: string;
  readonly track: string;
  readonly stage: string;
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
  // Already seated, back from the characters: the button says "characters" from two on.
  players?: number;
}

// A player of this screen, who picks with their own device.
export interface PickerSeat {
  readonly playerId: PlayerId;
  readonly classId: string;
  readonly device: DeviceId | null;
}

// Confirming launches the night picked on the scene screen, which it names.
export interface ClassPickerModel {
  // The class of a touch screen's one player, who has no seat.
  classId: string;
  // Null in a game of one scene: there is no scene screen, so this one asks for the endless night.
  stage: StagePickerModel | null;
  endless: boolean;
  seats: readonly PickerSeat[];
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
  remote: boolean;
  host: boolean;
}

export interface LobbyModel {
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

// The end screen's leaderboard line: the run offered to share under the saved pseudo (asked
// again once refused), or its rank among today's verified runs, null past the board.
export type BoardLine =
  | { readonly kind: 'share'; readonly pseudo: string; readonly refused: boolean }
  | { readonly kind: 'rank'; readonly rank: number | null };

// A line of the Classement screen, full game only: a verified run of the board, or one this device
// shared that the replay has not verified yet, at the place its score claims.
export interface LeaderboardRow {
  readonly rank: number;
  readonly pseudo: string;
  readonly classId: string;
  readonly score: number;
  // This device shared it.
  readonly mine: boolean;
  readonly pending: boolean;
}

// Best first, at most `BOARD_SIZE` each; empty when the board could not be read.
export interface Leaderboard {
  readonly today: readonly LeaderboardRow[];
  readonly allTime: readonly LeaderboardRow[];
}

// A team's game: its host, online or on one screen, restarts it or takes it back to the lobby.
// Absent, the game is solo.
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
  // Solo: a short set that asks the gestures of the game one by one.
  onLearn(): void;
  // A team's: on one screen the class picker shows again with the same players, online the room.
  onBackToLobby(): void;
  onQuit(): void;
  onChooseUpgrade(playerId: PlayerId, upgradeId: string): void;
  onRerollOffer(playerId: PlayerId): void;
  // The variant is the turn of a dealt card, 0 for the other cues.
  onUpgradeCue?(cue: UpgradeCue, variant: number): void;
  // Plays a circus weapon in the canvas of its card, until the returned function is called.
  onShowWeapon?(
    canvas: HTMLCanvasElement,
    weaponId: string,
    playerId: PlayerId,
  ): (() => void) | null;
  // Shows the player with a trap above the head, turning through them when there are several.
  onShowTrap?(
    canvas: HTMLCanvasElement,
    trapIds: readonly string[],
    playerId: PlayerId,
  ): (() => void) | null;
  // Paints a bad vibe's or a boss's mask, still, filling the canvas: the Programme's portraits.
  onPaintMask?(canvas: HTMLCanvasElement, enemyId: string): void;
  // Plays a stage's music as a game plays it, from the Programme; null gives the title music back.
  onListenStage?(setId: string | null): void;
  // Paints a class standing still, filling the canvas: the Programme's portraits of characters.
  onPaintClass?(canvas: HTMLCanvasElement, classId: string): void;
  // Plays a class's special as the game sounds it when cast.
  onPlaySpecial?(classId: string): void;
  // Plays a prop's sound as the game plays it, for the Programme; null for a silent prop.
  onWeaponSound?(weaponId: string): (() => void) | null;
  onToggleCalmMode(enabled: boolean): void;
  onToggleMute(muted: boolean): void;
  // From 1 to `VOLUME_STEPS`.
  onSetVolume(volume: number): void;
  onSetMix(bus: SoundBus, level: SoundLevel): void;
  onToggleHitSound(enabled: boolean): void;
  onToggleAutoFire(enabled: boolean): void;
  onToggleAutoAim(enabled: boolean): void;
  onSetPseudo(pseudo: string): void;
  onBoardName(pseudo: string): void;
  // The game reloads in it (ADR 0017).
  onChooseLocale(locale: Locale): void;
  onPlayOnline(): void;
  onChooseClass(classId: string): void;
  // Launches the game.
  onConfirmClass(): void;
  // Back to the scene picker, or to the title in a game of one scene.
  onLeaveClassPicker(): void;
  onJoinSeat(device: DeviceId): void;
  onLeaveSeat(playerId: PlayerId): void;
  // A player alone plays on with the device they hold.
  onHandOverSeat(playerId: PlayerId, device: DeviceId): void;
  onSeatClass(playerId: PlayerId, classId: string): void;
  // The name of this screen's own seat online: only online seats have one.
  onSeatName(name: string): void;
  onCreateRoom(): void;
  onJoinRoom(code: string): void;
  onChooseStage(setId: string): void;
  onToggleEndless(enabled: boolean): void;
  onChooseNight(night: Night): void;
  // On to the class picker.
  onConfirmStage(): void;
  // Back to the title.
  onLeaveStagePicker(): void;
  onLaunch(): void;
  onLeaveLobby(): void;
  onLeaveNotice(): void;
  // Set, it shows « Ton avis » and takes the menu intents until the form closes; `details` prefills it.
  onFeedback?(details?: string): void;
  // Menu intents go to the keys screen until it closes.
  onControls(): void;
  onChangelogOpened(): void;
  // The Classement screen opened: the app reads the boards, then `setLeaderboard`. Absent, the
  // title has no Classement entry: a build without `VITE_LEADERBOARD_URL` reads no board.
  onLeaderboardOpened?(): void;
  // Closes the game. Absent, the title has no Quit entry: a browser closes its own tab.
  onQuitApp?(): void;
}

export interface Ui {
  showTitle(options: {
    calmMode: boolean;
    muted: boolean;
    volume: number;
    mix: SoundMix;
    hitSound: boolean;
    autoFire: boolean;
    autoAim: boolean;
    pseudo: string;
    device: InputDevice;
  }): void;
  showClassPicker(model: ClassPickerModel): void;
  showVisits(count: number): void;
  showChangelogNews(news: boolean): void;
  setLeaderboard(board: Leaderboard): void;
  showStagePicker(model: StagePickerModel): void;
  showLobby(model: LobbyModel): void;
  updateLobby(model: LobbyModel): void;
  showNotice(notice: Notice, details: string): void;
  // A tutorial game asks the player its gestures one by one.
  showGame(tutorial: boolean): void;
  // Once per step of the sim, which only shows its events during that step.
  observeStep(state: SimState): StepGuide;
  // `best`: this device's record for the night before the game, null for the first game.
  showEnd(state: SimState, session: EndSession | undefined, best: number | null): void;
  setBoardLine(line: BoardLine | null): void;
  update(state: SimState, frame: UiFrame, content: GameContent): void;
  destroy(): void;
}

// What the arena shows a step asks: the gesture the tutorial asks now, null outside it, and its key
// ('' on touch); the players whose first trap calls them, until they move one, the same list while
// it does not change.
export interface StepGuide {
  readonly tutorial: TutorialStep | null;
  readonly tutorialKey: string;
  readonly trapCallers: readonly PlayerId[];
  // The trap each player's place key would take, since that tick, with the key's name on their device: '' on touch,
  // and for a player on another screen. The same array while nothing changes.
  readonly keyTraps: readonly {
    readonly playerId: PlayerId;
    readonly trapId: EntityId;
    readonly since: number;
    readonly key: string;
  }[];
}

export type CreateUi = (root: HTMLElement, callbacks: UiCallbacks) => Ui;

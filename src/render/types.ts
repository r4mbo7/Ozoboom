import type { EntityId, PlayerId, SimState, Vec2 } from '../sim/state';

// The dash: its arc at the player's feet kicks on every beat, its key under them ('' on touch, where
// the button calls instead). A trap to move: once it is carried, a dashed outline further on says
// where to put it down.
export interface TutorialCall {
  readonly gesture: 'dash' | 'trap';
  readonly key: string;
}

// The trap a player's place key would take, since that tick, and the key's name on their device (''
// on touch, or for a player on another screen): the trap answers them, and after two bars the key
// shows beside it.
export interface KeyTrap {
  readonly playerId: PlayerId;
  readonly trapId: EntityId;
  readonly since: number;
  readonly key: string;
}

export type CameraFocus = { kind: 'player'; playerId: PlayerId } | { kind: 'everyone' };

// The two bars a run opens on, in page milliseconds (`performance.now`): from `startsAt` the
// festival seen from the sky, a dive over the second bar, and the game from `landsAt`.
export interface StageEntry {
  readonly startsAt: number;
  readonly beatMs: number;
  readonly landsAt: number;
}

export interface RenderOptions {
  calmMode: boolean;
  focus?: CameraFocus;
  // The tutorial asks to plug a speaker: the way to the nearest one shows.
  guideToSpeaker?: boolean;
  // The players who have not moved a trap yet: the oldest trap each has on the field kicks to call them.
  trapCallers?: readonly PlayerId[];
  // The tutorial asks to dash or to move a trap: the arena calls where the eyes are.
  tutorialCall?: TutorialCall | null;
  // The trap each player's place key would take, as the HUD names it.
  keyTraps?: readonly KeyTrap[];
  // World units from top to bottom of the screen; absent, the camera's own for the screen's height.
  viewHeight?: number;
  // While the game waits for the beat it resumes on after its cards, that beat's page time
  // (`performance.now`); null otherwise.
  resumesAt?: number | null;
  // The entry the run opens on, kept a bar past its landing for the landing's effects; null otherwise.
  entry?: StageEntry | null;
}

// The scene of a weapon on its card, painted before each image; `viewHeight` is in world units.
export interface Inset {
  readonly canvas: HTMLCanvasElement;
  readonly state: SimState;
  readonly viewHeight: number;
  // The game the inset is shown over: its ground is lit at that game's hour.
  readonly played: SimState;
}

export interface Renderer {
  // `still`: the game has not changed since the last image, only what is painted over it is drawn.
  render(state: SimState, alpha: number, still?: boolean): void;
  setInsets(insets: readonly Inset[]): void;
  setOptions(options: Partial<RenderOptions>): void;
  resize(width: number, height: number): void;
  screenToWorld(point: Vec2): Vec2;
  worldToScreen(point: Vec2): Vec2;
  destroy(): void;
}

import type { PlayerId, SimState, Vec2 } from '../sim/state';

export type CameraFocus = { kind: 'player'; playerId: PlayerId } | { kind: 'everyone' };

export interface RenderOptions {
  calmMode: boolean;
  focus?: CameraFocus;
  // The tutorial asks to plug a speaker: the way to the nearest one shows.
  guideToSpeaker?: boolean;
  // World units from top to bottom of the screen; absent, the camera's own for the screen's height.
  viewHeight?: number;
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
  destroy(): void;
}

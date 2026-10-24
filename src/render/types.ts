import type { PlayerId, SimState, Vec2 } from '../sim/state';

export type CameraFocus = { kind: 'player'; playerId: PlayerId } | { kind: 'everyone' };

export interface RenderOptions {
  calmMode: boolean;
  focus?: CameraFocus;
}

// A small view of another world, painted into a canvas of the page before each image of the game:
// the scene of a weapon on its card. It shows `viewHeight` units of that world from top to bottom.
export interface Inset {
  readonly canvas: HTMLCanvasElement;
  readonly state: SimState;
  readonly viewHeight: number;
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

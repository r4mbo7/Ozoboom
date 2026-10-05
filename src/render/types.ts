import type { PlayerId, SimState, Vec2 } from '../sim/state';

export type CameraFocus = { kind: 'player'; playerId: PlayerId } | { kind: 'everyone' };

export interface RenderOptions {
  calmMode: boolean;
  focus?: CameraFocus;
}

export interface Renderer {
  render(state: SimState, alpha: number): void;
  setOptions(options: Partial<RenderOptions>): void;
  resize(width: number, height: number): void;
  screenToWorld(point: Vec2): Vec2;
  destroy(): void;
}

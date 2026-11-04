import type { PlayerId, SimState, Vec2 } from './state';
import type { StepContext, System } from './systems/types';

// A way to play past one set (ADR 0018); its systems run on each running step before `status`.
export interface GameMode {
  start?(ctx: StepContext): void;
  readonly systems: readonly System[];
  finishWins(ctx: StepContext): boolean;
  // Undefined: the balance bot walks as in a game of one set.
  readonly botMove?: (state: SimState, playerId: PlayerId) => Vec2 | undefined;
}

export function finishWins(ctx: StepContext): boolean {
  return ctx.mode?.finishWins(ctx) ?? true;
}

// Besides the bad vibes, what the assist may aim at for a player.
export type AimTargets = (
  state: SimState,
  playerId: PlayerId,
) => { x: number; y: number; radius: number; hp: number }[];

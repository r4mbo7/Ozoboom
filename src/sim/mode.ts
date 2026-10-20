import type { PlayerId, SimState, Vec2 } from './state';
import type { StepContext, System } from './systems/types';

// A way to play past one set (ADR 0018), the Full festival of src/sim/full/festival.ts: it poses its state once
// the game is created, its systems run on each running step before `status`, and it says whether the set played
// to its end wins the game, which otherwise goes on.
export interface GameMode {
  start?(ctx: StepContext): void;
  readonly systems: readonly System[];
  finishWins(ctx: StepContext): boolean;
  // Where the balance bench's bot walks in such a game, when not where the bot of one set would.
  readonly botMove?: (state: SimState, playerId: PlayerId) => Vec2 | undefined;
}

// Whether finishing the set played ends the game: always, but in a mode that goes on.
export function finishWins(ctx: StepContext): boolean {
  return ctx.mode?.finishWins(ctx) ?? true;
}

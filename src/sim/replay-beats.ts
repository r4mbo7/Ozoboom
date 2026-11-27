import type { ReplayBeats } from './commands';
import { FULL_STEPS } from './full';
import { playedTempo } from './lineup';
import type { StepContext } from './systems/types';

// The pick that ends a card choice may have the game play the last `beats` of the bar it froze on
// again, with the music. A tick anchored to a grid line that can wait across a choice moves here.
export function replayBeats(ctx: StepContext, beats: ReplayBeats): void {
  if (beats === 0) {
    return;
  }
  const { state } = ctx;
  const ticks = beats * ctx.tempo.ticksPerBeat;
  const progress = state.set;
  progress.replayTicks = (progress.replayTicks ?? 0) + ticks;
  progress.segmentReplayTicks = (progress.segmentReplayTicks ?? 0) + ticks;
  progress.replayEndTick = state.tick + 1 + ticks;
  ctx.tempo = playedTempo(ctx.set, state);
  const later = (tick: number): number => (tick > state.tick ? tick + ticks : tick);
  const { blackout, gust } = state;
  if (blackout !== undefined) {
    blackout.startTick = later(blackout.startTick);
    blackout.endTick = later(blackout.endTick);
  }
  if (gust !== undefined) {
    gust.warnTick = later(gust.warnTick);
    gust.blowTick = later(gust.blowTick);
    gust.endTick = later(gust.endTick);
  }
  for (const slot of state.players.flatMap((player) => player.weapons ?? [])) {
    if (slot.ghostTick !== undefined) {
      slot.ghostTick = later(slot.ghostTick);
    }
  }
  FULL_STEPS.replayed?.(state, ticks);
}

import { isBarTick } from '../../shared/tempo';
import { finishWins } from '../mode';
import { dropEndTick, isSetFinished } from './set-progress';
import type { StepContext } from './types';

export function status(ctx: StepContext): void {
  const { state, set } = ctx;
  if (state.core.hp <= 0 || state.players.every((player) => player.downed)) {
    state.status = 'lost';
    state.events.push({ type: 'gameLost' });
    return;
  }
  if (isSetFinished(state.set, set) && finishWins(ctx)) {
    state.status = 'won';
    state.events.push({ type: 'gameWon' });
    return;
  }
  const choosing =
    state.pendingUpgrades.length > 0 && (state.status === 'choosingUpgrade' || opensCards(ctx));
  state.status = choosing ? 'choosingUpgrade' : 'running';
}

// The cards open on a bar line, frozen on the last tick of the bar that ends there, so that the music
// loops that bar and the game resumes on the line; while a drop's bosses are down, on its last.
function opensCards({ state, tempo }: StepContext): boolean {
  const next = state.tick + 1;
  if (!isBarTick(next, tempo)) {
    return false;
  }
  const end = dropEndTick(state.set, tempo);
  return end === null || next >= end;
}

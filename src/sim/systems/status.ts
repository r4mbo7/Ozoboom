import { isSetFinished } from './set-progress';
import type { StepContext } from './types';

export function status({ state, set }: StepContext): void {
  if (state.core.hp <= 0 || state.players.every((player) => player.downed)) {
    state.status = 'lost';
    state.events.push({ type: 'gameLost' });
    return;
  }
  if (isSetFinished(state.set, set)) {
    state.status = 'won';
    state.events.push({ type: 'gameWon' });
    return;
  }
  state.status = state.pendingUpgrades.length > 0 ? 'choosingUpgrade' : 'running';
}

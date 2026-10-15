import type { Positioned } from '../state';
import type { StepContext } from './types';

export function beginStep({ state }: StepContext): void {
  state.events.length = 0;
  rememberPositions(state.players);
  rememberPositions(state.enemies);
  rememberPositions(state.projectiles);
  rememberPositions(state.traps);
  rememberPositions(state.pickups);
  rememberPositions(state.bystanders ?? []);
  rememberPositions(state.placed ?? []);
  if (state.status === 'running') {
    state.tick += 1;
  }
  for (const enemy of state.enemies) {
    if (enemy.markedUntilTick !== undefined && enemy.markedUntilTick <= state.tick) {
      enemy.marked = false;
      delete enemy.markedUntilTick;
    }
  }
}

function rememberPositions(entities: readonly Positioned[]): void {
  for (const entity of entities) {
    entity.prevX = entity.x;
    entity.prevY = entity.y;
  }
}

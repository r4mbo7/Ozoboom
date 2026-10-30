import { lapseMarks } from '../effects';
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
  rememberPositions(state.recruits ?? []);
  rememberPositions(state.props ?? []);
  rememberPositions(state.summon?.heavy ?? []);
  if (state.status === 'running') {
    state.tick += 1;
  }
  for (const enemy of state.enemies) {
    lapseMarks(enemy, state.tick);
  }
}

function rememberPositions(entities: readonly Positioned[]): void {
  for (const entity of entities) {
    entity.prevX = entity.x;
    entity.prevY = entity.y;
  }
}

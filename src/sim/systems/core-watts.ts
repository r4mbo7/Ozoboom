import { isBarTick } from '../../shared/tempo';
import type { StepContext } from './types';

export function coreWatts({ state, set }: StepContext): void {
  if (isBarTick(state.tick)) {
    state.core.watts += set.core.wattsPerBar;
  }
}

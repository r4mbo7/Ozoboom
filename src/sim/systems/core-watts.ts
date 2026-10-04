import { isBarTick } from '../../shared/tempo';
import { statValue } from '../stats';
import type { StepContext } from './types';

export function coreWatts({ state, set }: StepContext): void {
  if (!isBarTick(state.tick)) {
    return;
  }
  let watts = set.core.wattsPerBar;
  for (const player of state.players) {
    watts = statValue(player, 'wattsPerBarAdd', watts);
  }
  state.core.watts += watts;
}

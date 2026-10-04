import type { SetDefinition } from '../../data/types';
import type { PlayerCommand } from '../commands';
import type { ResolvedContent } from '../content';
import type { SpatialHash } from '../spatial-hash';
import type { PlayerId, SimState } from '../state';

export interface StepContext {
  state: SimState;
  content: ResolvedContent;
  set: SetDefinition;
  commands: ReadonlyMap<PlayerId, PlayerCommand>;
  enemyGrid: SpatialHash;
}

export type System = (ctx: StepContext) => void;

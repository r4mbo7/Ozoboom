import type { SetDefinition } from '../../data/types';
import type { Tempo } from '../../shared/tempo';
import type { PlayerCommand } from '../commands';
import type { ResolvedContent } from '../content';
import type { FlowFields } from '../flow-field';
import type { SpatialHash } from '../spatial-hash';
import type { PlayerId, SimState } from '../state';

export interface StepContext {
  state: SimState;
  content: ResolvedContent;
  set: SetDefinition;
  tempo: Tempo;
  commands: ReadonlyMap<PlayerId, PlayerCommand>;
  enemyGrid: SpatialHash;
  // Absent on a set without obstacles.
  flowFields: FlowFields | undefined;
}

export type System = (ctx: StepContext) => void;

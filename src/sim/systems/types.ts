import type { SetDefinition } from '../../data/types';
import type { Tempo } from '../../shared/tempo';
import type { PlayerCommand } from '../commands';
import type { ResolvedContent } from '../content';
import type { FlowFields } from '../flow-field';
import type { GameMode } from '../mode';
import type { SpatialHash } from '../spatial-hash';
import type { PlayerId, SimState } from '../state';

export interface StepContext {
  state: SimState;
  content: ResolvedContent;
  set: SetDefinition;
  tempo: Tempo;
  commands: ReadonlyMap<PlayerId, PlayerCommand>;
  enemyGrid: SpatialHash;
  // Absent on a set without obstacles or without bad vibes.
  flowFields: FlowFields | undefined;
  // Absent in a game of one set.
  mode: GameMode | undefined;
}

export type System = (ctx: StepContext) => void;

export interface FullSteps {
  readonly afterMovement?: readonly System[];
  readonly afterSpawning?: readonly System[];
  // `traps` leaves alone the pose key one of them took.
  readonly tookPoseKey?: (ctx: StepContext, playerId: PlayerId) => boolean;
}

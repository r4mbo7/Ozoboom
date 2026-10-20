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

// The systems of the full game at fixed places of a running step (src/sim/full.ts), and whether one of
// them took a player's pose key this step, which `traps` then leaves alone.
export interface FullSteps {
  readonly afterMovement?: readonly System[];
  readonly afterSpawning?: readonly System[];
  readonly posed?: (ctx: StepContext, playerId: PlayerId) => boolean;
}

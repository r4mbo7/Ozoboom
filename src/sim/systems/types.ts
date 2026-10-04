import type { SetDefinition } from '../../data/types';
import type { PlayerCommand } from '../commands';
import type { ResolvedContent } from '../content';
import type { PlayerId, SimState } from '../state';

export interface StepContext {
  state: SimState;
  content: ResolvedContent;
  set: SetDefinition;
  commands: ReadonlyMap<PlayerId, PlayerCommand>;
}

export type System = (ctx: StepContext) => void;

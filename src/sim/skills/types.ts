import type { SkillEffect } from '../../data/types';
import type { PlayerInput } from '../commands';
import type { PlayerState } from '../state';
import type { StepContext } from '../systems/types';

export type SkillOf<K extends SkillEffect['kind']> = Extract<SkillEffect, { kind: K }>;

export interface SkillModule<E extends SkillEffect> {
  // Runs when a standing player whose class has this skill casts it, at `power` times its strength.
  cast(ctx: StepContext, player: PlayerState, effect: E, input: PlayerInput, power: number): void;
  // Runs once per tick after the casts, for what the skill leaves in the game.
  update?(ctx: StepContext): void;
}

export type SkillModules = {
  readonly [K in SkillEffect['kind']]: SkillModule<SkillOf<K>>;
};

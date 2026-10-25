import type { AttackDefinition } from '../../data/types';
import type { PlayerInput } from '../commands';
import type { PlayerState, SimState, Vec2 } from '../state';
import type { StepContext } from '../systems/types';

export type Upgraded = Pick<PlayerState, 'modifiers' | 'suppressedTicks' | 'boosts'>;

export interface AttackModule<A extends AttackDefinition> {
  // Every tick, for each standing player of a class with this attack.
  step(ctx: StepContext, player: PlayerState, attack: A, input: PlayerInput): void;
  // The bot keeps to it; the aim and the class screen show it.
  reach(attack: A, player: Upgraded): number;
  // Touch and automatic fire let go at half of it.
  chargeTicks?(attack: A): number;
  // Shots spend what the player must get back (clubs): the bot fires only at what it reaches.
  readonly ammunition?: true;
  // Once per tick after every player's step, whoever threw what it left, standing or not.
  update?(ctx: StepContext): void;
  // Where the bot walks to keep attacking (a club lying on the ground).
  fetch?(state: SimState, player: PlayerState, attack: A): Vec2 | undefined;
}

export type AttackModules = {
  readonly [K in AttackDefinition['kind']]: AttackModule<Extract<AttackDefinition, { kind: K }>>;
};

import type { AttackDefinition } from '../../data/types';
import type { PlayerInput } from '../commands';
import type { PlayerState, SimState, Vec2 } from '../state';
import type { StepContext } from '../systems/types';

export type Upgraded = Pick<PlayerState, 'modifiers' | 'suppressedTicks' | 'boosts'>;

export interface AttackModule<A extends AttackDefinition> {
  // Runs on every tick for each standing player whose class has this attack.
  step(ctx: StepContext, player: PlayerState, attack: A, input: PlayerInput): void;
  // How far from the player the attack hits: the bot keeps to it, the aim and the class screen show it.
  reach(attack: A, player: Upgraded): number;
  // For an attack that charges while the fire is held: the ticks to full charge. Touch and
  // automatic fire let go at half of it.
  chargeTicks?(attack: A): number;
  // Each shot spends what the player has to get back (the Jongleur's clubs): the bot fires only
  // at what it reaches.
  readonly ammunition?: true;
  // Runs once per tick after every player's step, for what the attack leaves in the game,
  // whoever threw it, standing or not.
  update?(ctx: StepContext): void;
  // Where the player should walk to keep attacking (a club lying on the ground), if anywhere: the
  // bot goes there.
  fetch?(state: SimState, player: PlayerState, attack: A): Vec2 | undefined;
}

export type AttackModules = {
  readonly [K in AttackDefinition['kind']]: AttackModule<Extract<AttackDefinition, { kind: K }>>;
};

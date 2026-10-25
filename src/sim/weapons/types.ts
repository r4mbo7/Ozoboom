import type { WeaponDefinition } from '../../data/types';
import type { EnemyState, PlayerState, Vec2, WeaponSlot } from '../state';
import type { StepContext } from '../systems/types';

export interface WeaponShot {
  // `compound(levelMul, level - 1)`: scales the effect's damage and healing.
  power: number;
  target: EnemyState | null;
  // Along the player's aim without a target.
  direction: Vec2;
}

export interface WeaponModule {
  // False when nothing left on this beat: the weapon is not announced fired.
  fire(
    ctx: StepContext,
    player: PlayerState,
    slot: WeaponSlot,
    definition: WeaponDefinition,
    shot: WeaponShot,
  ): boolean;
}

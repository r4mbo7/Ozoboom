import type { WeaponDefinition } from '../../data/types';
import type { EnemyState, PlayerState, WeaponSlot } from '../state';
import type { StepContext } from '../systems/types';

export interface WeaponShot {
  // `compound(levelMul, level - 1)`: scales the effect's damage and healing.
  power: number;
  // Closest enemy to the player, or null when none is alive.
  target: EnemyState | null;
}

export interface WeaponModule {
  fire(
    ctx: StepContext,
    player: PlayerState,
    slot: WeaponSlot,
    definition: WeaponDefinition,
    shot: WeaponShot,
  ): void;
}

import type { WeaponDefinition } from '../../data/types';
import type { EnemyState, PlayerState, Vec2, WeaponSlot } from '../state';
import type { StepContext } from '../systems/types';

export interface WeaponShot {
  // `compound(levelMul, level - 1)`: scales the effect's damage and healing.
  power: number;
  // Closest enemy to the player, or null when none is alive.
  target: EnemyState | null;
  // Unit vector towards `target`, or along the player's aim without one: where an aimed weapon goes.
  direction: Vec2;
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

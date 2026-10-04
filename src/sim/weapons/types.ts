import type { WeaponDefinition } from '../../data/types';
import type { PlayerState, WeaponSlot } from '../state';
import type { StepContext } from '../systems/types';

export interface WeaponModule {
  fire(ctx: StepContext, player: PlayerState, slot: WeaponSlot, definition: WeaponDefinition): void;
}

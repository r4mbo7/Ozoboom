import { TICKS_PER_BAR } from '../../shared/tempo';
import { place } from './place';
import type { WeaponModule } from './types';

export const plate: WeaponModule = {
  fire({ state }, player, slot, { effect }) {
    if (effect.kind !== 'plate') {
      return;
    }
    place(
      state,
      player,
      slot.id,
      player,
      effect.radius,
      effect.durationBars * TICKS_PER_BAR,
      effect.maxPlaced,
    );
  },
};

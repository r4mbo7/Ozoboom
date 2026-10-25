import { place } from './place';
import type { WeaponModule } from './types';

export const plate: WeaponModule = {
  fire({ state, tempo }, player, slot, { effect }) {
    if (effect.kind !== 'plate') {
      return false;
    }
    place(
      state,
      player,
      slot.id,
      player,
      effect.radius,
      effect.durationBars * tempo.ticksPerBar,
      effect.maxPlaced,
    );
    return true;
  },
};

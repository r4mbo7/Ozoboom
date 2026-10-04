import { TICKS_PER_BAR } from '../../shared/tempo';
import { place } from './place';
import type { WeaponModule } from './types';

// Distance from the player's edge to the totem's centre.
const PLANT_GAP = 40;

export const totem: WeaponModule = {
  fire({ state }, player, slot, { effect }) {
    if (effect.kind !== 'totem') {
      return;
    }
    const reach = player.radius + PLANT_GAP;
    const { width, height } = state.arena;
    place(
      state,
      player,
      slot.id,
      {
        x: Math.min(Math.max(player.x + player.aim.x * reach, 0), width),
        y: Math.min(Math.max(player.y + player.aim.y * reach, 0), height),
      },
      effect.radius,
      effect.durationBars * TICKS_PER_BAR,
      1,
    );
  },
};

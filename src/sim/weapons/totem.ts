import { place } from './place';
import type { WeaponModule } from './types';

// Distance from the player's edge to the totem's centre.
const PLANT_GAP = 40;

export const totem: WeaponModule = {
  fire({ state, set, tempo }, player, slot, { effect }, { direction }) {
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
        x: Math.min(Math.max(player.x + direction.x * reach, 0), width),
        y: Math.min(Math.max(player.y + direction.y * reach, 0), height),
      },
      effect.radius,
      effect.durationBars * tempo.ticksPerBar,
      1,
      set.obstacles,
    );
  },
};

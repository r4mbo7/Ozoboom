import { clamp } from '../../shared/scalar';
import { place } from './place';
import type { WeaponModule } from './types';

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
        x: clamp(player.x + direction.x * reach, 0, width),
        y: clamp(player.y + direction.y * reach, 0, height),
      },
      effect.radius,
      effect.durationBars * tempo.ticksPerBar,
      1,
      set.obstacles,
    );
  },
};

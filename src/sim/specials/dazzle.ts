import { touches } from '../effects';
import type { SpecialModule } from './types';

const DAZZLED_TICKS = 2;

export const dazzle: SpecialModule = ({ state }, enemy, effect) => {
  if (effect.kind !== 'dazzle') {
    return;
  }
  for (const player of state.players) {
    if (touches(player, enemy, effect.radius)) {
      player.dazzledTicks = DAZZLED_TICKS;
    }
  }
};

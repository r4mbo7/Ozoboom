import { hurtEnemy, markedDamageMul, knockBack, touches } from '../effects';
import type { WeaponModule } from './types';

const BEAT_ONE = 0;

export const hoop: WeaponModule = {
  fire({ state, content, tempo }, player, _slot, definition, { power }) {
    const { effect } = definition;
    if (effect.kind !== 'hoop') {
      throw new Error(`hoop fired for a "${effect.kind}" weapon`);
    }
    const inBar = state.tick % tempo.ticksPerBar;
    const beatThree = tempo.ticksPerBar / 2;
    const radius = inBar === BEAT_ONE || inBar === beatThree ? effect.wideRadius : effect.radius;
    const markedMul = markedDamageMul(content);
    for (const enemy of state.enemies) {
      if (enemy.hp > 0 && touches(enemy, player, radius)) {
        hurtEnemy(state, enemy, effect.damage * power, markedMul, player.id, player);
        knockBack(enemy, player, effect.knockback);
      }
    }
  },
};

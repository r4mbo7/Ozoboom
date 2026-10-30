import { hurtEnemy, knockBack, touches } from '../effects';
import { ticksIntoBar } from '../../shared/tempo';
import type { WeaponModule } from './types';

const BEAT_ONE = 0;

export const hoop: WeaponModule = {
  fire({ state, tempo, enemyObstacles }, player, _slot, definition, { power }) {
    const { effect } = definition;
    if (effect.kind !== 'hoop') {
      throw new Error(`hoop fired for a "${effect.kind}" weapon`);
    }
    const inBar = ticksIntoBar(state.tick, tempo);
    const beatThree = tempo.ticksPerBar / 2;
    const radius = inBar === BEAT_ONE || inBar === beatThree ? effect.wideRadius : effect.radius;
    for (const enemy of state.enemies) {
      if (enemy.hp > 0 && touches(enemy, player, radius)) {
        hurtEnemy(state, enemy, effect.damage * power, player.id, player);
        knockBack(enemy, player, effect.knockback, enemyObstacles);
      }
    }
    return true;
  },
};

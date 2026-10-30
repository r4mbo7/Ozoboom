import { hurtEnemy, knockBack, touches } from '../effects';
import type { SkillModule, SkillOf } from './types';

export const nova: SkillModule<SkillOf<'nova'>> = {
  cast({ state, enemyObstacles }, player, effect, _input, power) {
    for (const enemy of state.enemies) {
      if (enemy.hp > 0 && touches(enemy, player, effect.radius)) {
        hurtEnemy(state, enemy, effect.damage * power, player.id, player);
        knockBack(enemy, player, effect.knockback, enemyObstacles);
      }
    }
  },
};

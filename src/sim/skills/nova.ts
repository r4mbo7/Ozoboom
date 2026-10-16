import { hurtEnemy, knockBack, markedDamageMul, touches } from '../effects';
import type { SkillModule, SkillOf } from './types';

export const nova: SkillModule<SkillOf<'nova'>> = {
  cast({ state, content }, player, effect, _input, power) {
    const markedMul = markedDamageMul(content);
    for (const enemy of state.enemies) {
      if (enemy.hp > 0 && touches(enemy, player, effect.radius)) {
        hurtEnemy(state, enemy, effect.damage * power, markedMul, player.id, player);
        knockBack(enemy, player, effect.knockback);
      }
    }
  },
};

import { unitFromAngle } from '../../shared/angle';
import { hurtEnemy, touches } from '../effects';
import type { WeaponModule } from './types';

const RADIANS_PER_DEGREE = Math.PI / 180;

export const sweep: WeaponModule = {
  fire({ state }, player, _slot, definition, { power, direction }) {
    const { effect } = definition;
    if (effect.kind !== 'sweep') {
      throw new Error(`sweep fired for a "${effect.kind}" weapon`);
    }
    const cosHalfArc = unitFromAngle((effect.arcDegrees / 2) * RADIANS_PER_DEGREE).x;
    const aimLength = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || !touches(enemy, player, effect.radius)) {
        continue;
      }
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const along = dx * direction.x + dy * direction.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (along >= cosHalfArc * distance * aimLength) {
        hurtEnemy(state, enemy, effect.damage * power, player.id, player);
      }
    }
    return true;
  },
};

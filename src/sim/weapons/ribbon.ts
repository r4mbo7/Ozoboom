import { markEnemy } from '../effects';
import type { WeaponModule } from './types';

const RIBBON_HALF_WIDTH = 14;

// A wave from the player towards the closest bad vibe marks every bad vibe it crosses.
export const ribbon: WeaponModule = {
  fire({ state, set }, player, _slot, { effect }, { direction }) {
    if (effect.kind !== 'ribbon') {
      return;
    }
    const length =
      effect.dropCrossesArena === true && state.set.segment === 'drop'
        ? Math.sqrt(set.arena.width * set.arena.width + set.arena.height * set.arena.height)
        : effect.length;
    const { x: dirX, y: dirY } = direction;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) {
        continue;
      }
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const along = dx * dirX + dy * dirY;
      const across = Math.abs(dx * dirY - dy * dirX);
      if (
        along >= -enemy.radius &&
        along <= length + enemy.radius &&
        across <= RIBBON_HALF_WIDTH + enemy.radius
      ) {
        markEnemy(state, enemy, effect.markedTicks);
      }
    }
  },
};

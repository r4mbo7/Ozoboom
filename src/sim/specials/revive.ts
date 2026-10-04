import { TICKS_PER_BAR } from '../../shared/tempo';
import type { SpecialModule } from './types';

// Called by `specials` every tick while alive (a no-op there) and by `deaths` once an enemy's hp
// reaches 0, which decides whether it goes down instead of dying or stands back up.
export const revive: SpecialModule = (ctx, enemy, effect) => {
  if (effect.kind !== 'revive' || enemy.hp > 0) {
    return;
  }
  if (enemy.downTicks === undefined) {
    const revivesLeft = enemy.revivesLeft ?? effect.times;
    if (revivesLeft <= 0) {
      return;
    }
    enemy.revivesLeft = revivesLeft - 1;
    enemy.downTicks = effect.downBars * TICKS_PER_BAR;
    return;
  }
  enemy.downTicks -= 1;
  if (enemy.downTicks <= 0) {
    delete enemy.downTicks;
    enemy.hp = enemy.maxHp * effect.hpRatio;
    ctx.state.events.push({
      type: 'enemyRevived',
      id: enemy.id,
      kind: enemy.kind,
      x: enemy.x,
      y: enemy.y,
    });
  }
};

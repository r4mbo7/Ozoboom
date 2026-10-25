import type { SpecialModule } from './types';

// A no-op from `specials`; `deaths` calls it at 0 hp to go down instead of dying, or stand back up.
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
    enemy.downTicks = effect.downBars * ctx.tempo.ticksPerBar;
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

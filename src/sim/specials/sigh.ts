import type { PlayerState, ProjectileState, SimState } from '../state';
import type { SpecialModule } from './types';

export const sigh: SpecialModule = (ctx, enemy, effect) => {
  if (effect.kind !== 'sigh') {
    return;
  }
  const { state } = ctx;
  for (const projectile of state.projectiles) {
    if (projectile.owner.kind !== 'enemy' || projectile.owner.enemyId !== enemy.id) {
      continue;
    }
    const player = aboutToBeTouched(state, projectile);
    if (player === undefined) {
      continue;
    }
    const expiresAtTick = state.tick + effect.durationTicks;
    if (
      player.slowFactorExpiresTick === undefined ||
      expiresAtTick > player.slowFactorExpiresTick
    ) {
      player.slowFactorExpiresTick = expiresAtTick;
      player.slowFactorValue = effect.slowFactor;
    }
    player.slowFactor = Math.min(player.slowFactor ?? 1, player.slowFactorValue ?? 1);
  }
};

// Predicts this tick's move, the same way `projectiles` resolves hits right after `specials`:
// a projectile still in flight is never touching anyone yet at its current (last tick's) position.
function aboutToBeTouched(state: SimState, projectile: ProjectileState): PlayerState | undefined {
  const nextX = projectile.x + projectile.vx;
  const nextY = projectile.y + projectile.vy;
  for (const player of state.players) {
    if (player.downed) {
      continue;
    }
    const dx = nextX - player.x;
    const dy = nextY - player.y;
    const reach = projectile.radius + player.radius;
    if (dx * dx + dy * dy <= reach * reach) {
      return player;
    }
  }
  return undefined;
}

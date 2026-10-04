import { TICKS_PER_BAR } from '../../shared/tempo';
import { touches } from '../effects';
import type { SpecialModule } from './types';

// Asleep is tracked through stunTicks, already an obstacle for steering and attacks, and already
// decremented each tick by `traps`.
export const yawn: SpecialModule = (ctx, enemy, effect) => {
  if (effect.kind !== 'yawn' || enemy.stunTicks > 0) {
    return;
  }
  const awakeTicks = enemy.awakeTicks ?? effect.awakeBars * TICKS_PER_BAR;
  if (awakeTicks <= 0) {
    delete enemy.awakeTicks;
    enemy.stunTicks = effect.sleepBars * TICKS_PER_BAR;
    return;
  }
  enemy.awakeTicks = awakeTicks - 1;
  for (const player of ctx.state.players) {
    if (!player.downed && touches(player, enemy, effect.radius)) {
      player.slowFactor = Math.min(player.slowFactor ?? 1, effect.slowFactor);
    }
  }
};

import { TICKS_PER_BAR } from '../../shared/tempo';
import type { StepContext } from '../systems/types';
import { shoot } from './shoot';
import type { WeaponModule } from './types';

export const lob: WeaponModule = {
  fire(ctx, player, slot, definition, { power, target }) {
    const { effect } = definition;
    if (effect.kind !== 'lob' || target === null) {
      return;
    }
    const raining = effect.dropRain === true && ctx.state.set.segment === 'drop';
    if (effect.dropRain === true && !raining && ctx.state.tick % TICKS_PER_BAR !== 0) {
      return;
    }
    const range = raining ? Math.hypot(ctx.set.arena.width, ctx.set.arena.height) : effect.range;
    const aim = densestSpot(ctx, player, range, effect.radius);
    if (aim === null) {
      return;
    }
    shoot(
      ctx.state,
      player,
      slot,
      { x: (aim.x - player.x) / effect.flightTicks, y: (aim.y - player.y) / effect.flightTicks },
      {
        radius: effect.radius,
        damage: effect.damage * power,
        ticksLeft: effect.flightTicks,
        pierceLeft: 0,
        arc: { toX: aim.x, toY: aim.y, ticksTotal: effect.flightTicks },
      },
    );
  },
};

// The enemy within `range` with the most bad vibes around it; the nearest one wins a tie. Reads
// the grid `weapons` just rebuilt for the closest-enemy query.
function densestSpot(
  { state, enemyGrid }: StepContext,
  from: { x: number; y: number },
  range: number,
  radius: number,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestCount = 0;
  let bestDistance = Infinity;
  for (const enemy of state.enemies) {
    const dx = enemy.x - from.x;
    const dy = enemy.y - from.y;
    const distance = dx * dx + dy * dy;
    if (enemy.hp <= 0 || distance > range * range) {
      continue;
    }
    let count = 0;
    const found = enemyGrid.query(enemy.x, enemy.y, radius);
    for (let i = 0; i < found; i++) {
      if ((state.enemies[enemyGrid.result(i)]?.hp ?? 0) > 0) {
        count += 1;
      }
    }
    if (count > bestCount || (count === bestCount && distance < bestDistance)) {
      best = enemy;
      bestCount = count;
      bestDistance = distance;
    }
  }
  return best === null ? null : { x: best.x, y: best.y };
}

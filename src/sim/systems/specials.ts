import { lookup } from '../content';
import { SPECIALS } from '../specials';
import { applyDerivedStats } from '../stats';
import type { StepContext } from './types';

export function specials(ctx: StepContext): void {
  const { state, content } = ctx;
  for (const player of state.players) {
    if (player.slowFactor !== undefined) {
      player.slowFactor = 1;
    }
    if (player.suppressedTicks !== undefined && player.suppressedTicks > 0) {
      player.suppressedTicks -= 1;
      if (player.suppressedTicks === 0) {
        applyDerivedStats(player, lookup(content.classes, player.classId, 'class'));
      }
    }
    if (player.dazzledTicks !== undefined) {
      player.dazzledTicks = Math.max(0, player.dazzledTicks - 1);
    }
  }
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) {
      continue;
    }
    const special = lookup(content.enemies, enemy.kind, 'enemy').special;
    if (special !== undefined) {
      SPECIALS[special.kind](ctx, enemy, special);
    }
  }
}

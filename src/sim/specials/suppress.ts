import { lookup } from '../content';
import { touches } from '../effects';
import { applyDerivedStats } from '../stats';
import type { SpecialModule } from './types';

const SUPPRESSED_TICKS = 2;

export const suppress: SpecialModule = ({ state, content }, enemy, effect) => {
  if (effect.kind !== 'suppress') {
    return;
  }
  for (const player of state.players) {
    if (!touches(player, enemy, effect.radius)) {
      continue;
    }
    const wasSuppressed = (player.suppressedTicks ?? 0) > 0;
    player.suppressedTicks = SUPPRESSED_TICKS;
    if (!wasSuppressed) {
      applyDerivedStats(player, lookup(content.classes, player.classId, 'class'));
    }
  }
};

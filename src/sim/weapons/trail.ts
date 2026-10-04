import { isBarTick } from '../../shared/tempo';
import { lookup } from '../content';
import { healPlayer, touches } from '../effects';
import { applyModifiers, refreshDerivedStats } from '../stats';
import type { WeaponModule } from './types';

const point = { x: 0, y: 0 };

export const trail: WeaponModule = {
  fire({ state, content }, player, slot, { effect }, { power }) {
    if (effect.kind !== 'trail') {
      return;
    }
    if (slot.trail === undefined) {
      slot.trail = new Array<number>(effect.lengthTicks * 2).fill(0);
      applyModifiers(player, [{ stat: 'speedMul', mul: effect.speedMul }]);
      refreshDerivedStats(player, lookup(content.classes, player.classId, 'class'));
    }
    const ring = slot.trail;
    const write = (state.tick % effect.lengthTicks) * 2;
    ring[write] = player.x;
    ring[write + 1] = player.y;
    slot.phase = Math.min(slot.phase + 1, effect.lengthTicks);

    for (const enemy of state.enemies) {
      if (enemy.hp > 0 && onTrail(enemy, ring, slot.phase, player.radius)) {
        enemy.slowFactor = Math.min(enemy.slowFactor, effect.slowFactor);
      }
    }
    if (isBarTick(state.tick)) {
      for (const ally of state.players) {
        if (!ally.downed && onTrail(ally, ring, slot.phase, player.radius)) {
          healPlayer(ally, effect.healPerBar * power);
        }
      }
    }
  },
};

function onTrail(
  body: { x: number; y: number; radius: number },
  ring: readonly number[],
  filled: number,
  width: number,
): boolean {
  for (let i = 0; i < filled; i++) {
    point.x = ring[i * 2] ?? 0;
    point.y = ring[i * 2 + 1] ?? 0;
    if (touches(body, point, width)) {
      return true;
    }
  }
  return false;
}

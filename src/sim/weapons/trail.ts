import { isBarTick } from '../../shared/tempo';
import { lookup } from '../content';
import { healPlayer, touches } from '../effects';
import { applyModifiers, refreshDerivedStats } from '../stats';
import type { WeaponModule } from './types';

const point = { x: 0, y: 0 };

export const trail: WeaponModule = {
  fire({ state, content, tempo }, player, slot, { effect }, { power }) {
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
      if (enemy.hp > 0 && onTrail(enemy, ring, state.tick, slot.phase, player.radius)) {
        enemy.slowFactor = Math.min(enemy.slowFactor, effect.slowFactor);
      }
    }
    if (isBarTick(state.tick, tempo)) {
      for (const ally of state.players) {
        if (!ally.downed && onTrail(ally, ring, state.tick, slot.phase, player.radius)) {
          healPlayer(state, ally, effect.healPerBar * power);
        }
      }
    }
  },
};

// The ring is written at `tick % length`: read back the `filled` most recent samples by age.
function onTrail(
  body: { x: number; y: number; radius: number },
  ring: readonly number[],
  tick: number,
  filled: number,
  width: number,
): boolean {
  const length = ring.length / 2;
  for (let age = 0; age < filled; age++) {
    const at = (((tick - age) % length) + length) % length;
    point.x = ring[at * 2] ?? 0;
    point.y = ring[at * 2 + 1] ?? 0;
    if (touches(body, point, width)) {
      return true;
    }
  }
  return false;
}

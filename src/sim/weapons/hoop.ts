import type { WeaponEffect } from '../../data/types';
import { compound, hurtEnemy, knockBack, touches } from '../effects';
import { ticksIntoBar } from '../../shared/tempo';
import type { WeaponModule } from './types';

const BEAT_ONE = 0;

type HoopEffect = Extract<WeaponEffect, { kind: 'hoop' }>;

// The factor both radii of a hoop of this level are scaled by: the render draws the thread there too.
export function hoopReach(effect: HoopEffect, level: number): number {
  return compound(effect.reachPerLevel, level - 1);
}

export const hoop: WeaponModule = {
  fire({ state, tempo, enemyObstacles }, player, slot, definition, { power }) {
    const { effect } = definition;
    if (effect.kind !== 'hoop') {
      throw new Error(`hoop fired for a "${effect.kind}" weapon`);
    }
    const inBar = ticksIntoBar(state.tick, tempo);
    const beatThree = tempo.ticksPerBar / 2;
    const wide = inBar === BEAT_ONE || inBar === beatThree;
    const radius = (wide ? effect.wideRadius : effect.radius) * hoopReach(effect, slot.level);
    for (const enemy of state.enemies) {
      if (enemy.hp > 0 && touches(enemy, player, radius)) {
        hurtEnemy(state, enemy, effect.damage * power, player.id, player);
        knockBack(enemy, player, effect.knockback, enemyObstacles);
      }
    }
    return true;
  },
};

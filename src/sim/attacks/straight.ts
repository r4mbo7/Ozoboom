import type { StraightAttack } from '../../data/types';
import { angleOf } from '../../shared/angle';
import { statValue } from '../stats';
import { fan } from './fan';
import { fireShot, type Shot } from './shot';
import { pullTrigger } from './trigger';
import type { AttackModule } from './types';

export const straight: AttackModule<StraightAttack> = {
  step({ state }, player, attack, input) {
    if (!pullTrigger(player, input.fire, attack.cooldownTicks)) {
      return;
    }
    const count = Math.max(1, Math.floor(statValue(player, 'projectileCountAdd', attack.count)));
    const shot: Shot = {
      speed: statValue(player, 'projectileSpeedMul', attack.projectileSpeed),
      radius: attack.projectileRadius,
      damage: statValue(player, 'damageMul', attack.damage),
      ticks: attack.rangeTicks,
      pierce: statValue(player, 'pierceAdd', attack.pierce),
      ...(attack.knockback === undefined ? {} : { knockback: attack.knockback }),
    };
    for (const way of fan(player.aim, count, attack.spreadRadians)) {
      fireShot(state, player, way, shot);
    }
    state.events.push({
      type: 'playerFired',
      playerId: player.id,
      x: player.x,
      y: player.y,
      angle: angleOf(player.aim),
    });
  },

  reach(attack, player) {
    return statValue(player, 'projectileSpeedMul', attack.projectileSpeed) * attack.rangeTicks;
  },
};

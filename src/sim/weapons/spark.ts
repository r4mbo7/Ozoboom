import { directionTo, shoot } from './shoot';
import type { WeaponModule } from './types';

const SPARK_RADIUS = 6;

export const spark: WeaponModule = {
  fire(ctx, player, slot, definition, { power, target }) {
    const { effect } = definition;
    if (effect.kind !== 'spark' || target === null) {
      return;
    }
    const direction = directionTo(player, target, player.aim);
    shoot(
      ctx.state,
      player,
      slot,
      { x: direction.x * effect.speed, y: direction.y * effect.speed },
      {
        radius: SPARK_RADIUS,
        damage: effect.damage * power,
        ticksLeft: effect.rangeTicks,
        pierceLeft: effect.pierce,
      },
    );
  },
};

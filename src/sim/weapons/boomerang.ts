import { directionTo, shoot } from './shoot';
import type { WeaponModule } from './types';

const FRISBEE_RADIUS = 10;
const HITS_EVERY_BAD_VIBE = 999;

export const boomerang: WeaponModule = {
  fire(ctx, player, slot, definition, { power, target }) {
    const { effect } = definition;
    if (effect.kind !== 'boomerang' || target === null) {
      return;
    }
    const inFlight = ctx.state.projectiles.some(
      ({ owner }) =>
        owner.kind === 'weapon' && owner.playerId === player.id && owner.weaponId === slot.id,
    );
    if (inFlight) {
      return;
    }
    const direction = directionTo(player, target, player.aim);
    shoot(
      ctx.state,
      player,
      slot,
      { x: direction.x * effect.speed, y: direction.y * effect.speed },
      {
        radius: FRISBEE_RADIUS,
        damage: effect.damage * power,
        ticksLeft: Math.ceil(effect.range / effect.speed),
        pierceLeft: HITS_EVERY_BAD_VIBE,
        returnTo: player.id,
        heal: effect.heal * power,
      },
    );
  },
};

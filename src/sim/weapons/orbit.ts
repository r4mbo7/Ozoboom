import { unitFromAngle } from '../../shared/angle';
import { ticksIntoBar } from '../../shared/tempo';
import { keepWhere } from '../effects';
import type { PlayerState, ProjectileState } from '../state';
import type { WeaponModule } from './types';

const TWO_PI = 2 * Math.PI;
// Bodies outlive their last repositioning by one tick, so they vanish once the weapon stops firing.
const BODY_TICKS = 2;
// It forgets the enemies it hit each half bar.
const ENDLESS_PIERCE = 1e9;

const isBodyOf =
  (player: PlayerState, weaponId: string) =>
  (projectile: ProjectileState): boolean =>
    projectile.owner.kind === 'weapon' &&
    projectile.owner.playerId === player.id &&
    projectile.owner.weaponId === weaponId;

export const orbit: WeaponModule = {
  fire({ state, tempo }, player, slot, definition, { power }) {
    const { effect } = definition;
    if (effect.kind !== 'orbit') {
      throw new Error(`orbit fired for a "${effect.kind}" weapon`);
    }
    const mine = isBodyOf(player, slot.id);
    let bodies = state.projectiles.filter(mine);
    const fresh = bodies.length !== effect.count;
    if (fresh) {
      keepWhere(state.projectiles, (projectile) => !mine(projectile));
      bodies = [];
      for (let i = 0; i < effect.count; i++) {
        const body: ProjectileState = {
          id: state.nextEntityId,
          owner: { kind: 'weapon', playerId: player.id, weaponId: slot.id },
          x: player.x,
          y: player.y,
          prevX: player.x,
          prevY: player.y,
          vx: 0,
          vy: 0,
          radius: effect.radius,
          damage: 0,
          ticksLeft: BODY_TICKS,
          pierceLeft: ENDLESS_PIERCE,
        };
        state.nextEntityId += 1;
        state.projectiles.push(body);
        bodies.push(body);
      }
    }
    slot.phase = (slot.phase + (TWO_PI * effect.turnsPerBar) / tempo.ticksPerBar) % TWO_PI;
    const forgets = ticksIntoBar(state.tick, tempo) % (tempo.ticksPerBar / 2) === 0;
    bodies.forEach((body, i) => {
      const direction = unitFromAngle(slot.phase + (i * TWO_PI) / effect.count);
      // Past the edge of the arena too: `projectiles` leaves it there.
      body.x = player.x + direction.x * effect.orbitRadius;
      body.y = player.y + direction.y * effect.orbitRadius;
      if (fresh) {
        body.prevX = body.x;
        body.prevY = body.y;
      }
      body.damage = effect.damage * power;
      body.ticksLeft = BODY_TICKS;
      if (forgets) {
        delete body.hitIds;
      }
    });
  },
};

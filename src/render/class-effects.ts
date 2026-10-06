import type { SimEvent, SimState } from '../sim/state';
import { createCareBursts } from './care-bursts';
import { createChargeBursts } from './charge-bursts';
import { createBurster } from './class-bursts';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { byId } from './util';

// What the roadie and the care add to the picture: read from the events and from the kind of the
// skill of the class of the player, never from a class identifier.
export function createClassEffects(
  ctx: RenderContext,
  blinkEnemy: (id: number, untilTick: number) => void,
): Family {
  const burster = createBurster(ctx);
  const { bursts } = burster;
  const charge = createChargeBursts(ctx, burster, blinkEnemy);
  const care = createCareBursts(ctx, burster);

  function used(state: SimState, playerId: number, frame: Frame): void {
    const player = byId(state.players, playerId);
    const effect = player && ctx.skillEffects.get(player.classId);
    if (player === undefined || effect === undefined) {
      return;
    }
    if (effect.kind === 'dash') {
      charge.dashTrail(state, player, effect.distance, frame);
    } else if (effect.kind === 'nova') {
      charge.nova(state, player, effect.radius, frame);
    } else {
      care.heal(state, player, effect.radius, frame);
    }
  }

  function reset(): void {
    bursts.clear();
  }

  return {
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      switch (event.type) {
        case 'skillUsed':
          used(state, event.playerId, frame);
          break;
        case 'taunted':
          charge.pull(state, event, frame);
          break;
        case 'playerHealed': {
          const player = byId(state.players, event.playerId);
          if (player !== undefined && event.amount > 0) {
            care.reflect(state, player, frame);
          }
          break;
        }
        case 'coreRepaired':
          if (event.amount > 0) {
            care.repairGlow(state, frame);
          }
          break;
        case 'playerRevived': {
          const player = byId(state.players, event.playerId);
          if (player !== undefined) {
            care.revive(state, player, frame);
          }
          break;
        }
        default:
          break;
      }
    },
    update(state: SimState, alpha: number, frame: Frame): void {
      bursts.update(state, alpha, frame);
    },
    reset,
    destroy: reset,
  };
}

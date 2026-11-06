import type { TrapCadence } from '../../data/types';
import type { SimState } from '../state';
import { fireTrap, trapDefinition, trapSilenced } from '../trap-fire';
import { moveTrap } from '../trap-moves';
import { rechargeTraps, wearTraps } from '../trap-wear';
import { FULL_STEPS } from '../full';
import type { StepContext } from './types';

export function traps(ctx: StepContext): void {
  const { state, content, commands } = ctx;
  for (const player of state.players) {
    for (const action of commands.get(player.id)?.actions ?? []) {
      if (action.type === 'moveTrap' && FULL_STEPS.tookPoseKey?.(ctx, player.id) !== true) {
        moveTrap(ctx, player);
      }
    }
  }

  if (state.traps.length > 0) {
    ctx.enemyGrid.rebuild(state.enemies);
  }
  const firing = cadencesFiring(state);
  const fireAll = (lures: boolean) => {
    for (const trap of state.traps) {
      const definition = trapDefinition(content, trap);
      const lure = definition.effect.kind === 'lure';
      if (firing[definition.cadence] && lure === lures && !trapSilenced(state, trap)) {
        fireTrap(ctx, trap, definition);
      }
    }
  };

  fireAll(true);
  for (const enemy of state.enemies) {
    enemy.slowFactor = 1;
    enemy.stunTicks = Math.max(0, enemy.stunTicks - 1);
  }
  fireAll(false);
  for (const trap of state.traps) {
    if (trap.shortedTicks !== undefined) {
      trap.shortedTicks -= 1;
      if (trap.shortedTicks <= 0) {
        delete trap.shortedTicks;
      }
    }
  }
  rechargeTraps(ctx);
  wearTraps(ctx);
}

function cadencesFiring(state: SimState): Readonly<Record<TrapCadence, boolean>> {
  let beat = false;
  let bar = false;
  let drop = false;
  for (const event of state.events) {
    beat ||= event.type === 'beat';
    bar ||= event.type === 'bar';
    drop ||= event.type === 'segment' && event.segment === 'drop';
  }
  return { beat, bar, drop, continuous: true };
}

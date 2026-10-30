import type { EntityId } from '../sim/state';
import type { Family, RenderContext } from './context';
import { createCarried } from './weapon-carried';
import { createDevilStick } from './weapon-devil-stick';
import { createFlight } from './weapon-flight';
import { createGround } from './weapon-ground';
import { createKit } from './weapon-kit';
import { drawFiring } from './weapon-shots';

export interface WeaponsFamily extends Family {
  readonly marks: number;
  readonly transients: number;
  readonly ribbons: number;
  shadowOf(projectileId: EntityId): { scale: number; alpha: number; visible: boolean } | undefined;
}

export function createWeapons(ctx: RenderContext): WeaponsFamily {
  const kit = createKit(ctx);
  const carried = createCarried(ctx, kit);
  const devilStick = createDevilStick(ctx, kit);
  const flight = createFlight(ctx, kit);
  const ground = createGround(ctx, kit);

  function clear(): void {
    kit.transients.clear();
    kit.ribbons.clear();
  }

  return {
    get marks() {
      return ground.marks;
    },
    get transients() {
      return kit.transients.active;
    },
    get ribbons() {
      return kit.ribbons.active;
    },
    shadowOf: (id) => flight.shadowOf(id),
    update(state, alpha, frame) {
      carried.update(state, alpha, frame);
      devilStick.update(state, alpha, frame);
      flight.update(state, alpha, frame);
      ground.update(state, alpha, frame);
      kit.transients.update(frame.now);
      kit.ribbons.update(frame.now, frame.palette, frame.calm);
    },
    onEvent(event, state, frame) {
      drawFiring(ctx, kit, event, state, frame);
      devilStick.onEvent(event, state, frame);
    },
    reset() {
      clear();
      flight.reset?.();
    },
    destroy() {
      clear();
      ctx.layers.weapons.destroy({ children: true });
    },
  };
}

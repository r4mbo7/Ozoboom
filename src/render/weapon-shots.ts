import { TICKS_PER_BEAT } from '../shared/tempo';
import type { SimEvent, SimState } from '../sim/state';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import type { WeaponKit } from './weapon-kit';
import { byId } from './util';

const SWING_TICKS = TICKS_PER_BEAT * 0.6;

// What a weapon does the instant it fires: the arc of the baton, the rings of the hoops, the ribbon. The shots that stay in the state are drawn from it instead.
export function drawFiring(
  ctx: RenderContext,
  kit: WeaponKit,
  event: SimEvent,
  state: SimState,
  frame: Frame,
): void {
  if (event.type !== 'weaponFired') {
    return;
  }
  const { weapons: w, ring } = ctx.textures;
  const look = kit.style(event.weaponId);
  const { effect } = look.look;
  const peak = frame.calm ? 0.5 : 0.9;
  const player = byId(state.players, event.playerId);
  const aim = player === undefined ? 0 : Math.atan2(player.aim.y, player.aim.x);
  const at = {
    now: state.tick,
    x: event.x,
    y: event.y,
    tint: frame.palette[look.token],
    peak,
  };
  const { transients } = kit;
  if (effect.kind === 'sweep') {
    const full = effect.arcDegrees >= 270;
    for (let copy = 0; copy < look.copies; copy += 1) {
      transients.spawn({
        ...at,
        shape: full ? w.swingFull : w.swing,
        duration: SWING_TICKS,
        angle: full ? 0 : aim - 0.6,
        spin: (full ? 1.8 : 1.2) * (copy % 2 === 0 ? 1 : -1),
        fromRadius: effect.radius * 0.55,
        toRadius: effect.radius,
      });
    }
  } else if (effect.kind === 'hoop') {
    for (let copy = 0; copy < look.copies; copy += 1) {
      const shrink = 1 - 0.18 * copy;
      transients.spawn({
        ...at,
        shape: w.hoopRing,
        duration: TICKS_PER_BEAT * 1.8,
        fromRadius: effect.radius * shrink,
        toRadius: effect.wideRadius * shrink,
      });
    }
    transients.spawn({
      ...at,
      shape: ring,
      duration: TICKS_PER_BEAT,
      fromRadius: effect.radius,
      toRadius: effect.wideRadius * 1.3,
      peak: peak * 0.55,
    });
  } else if (effect.kind === 'ribbon') {
    kit.ribbons.spawn(state.tick, event.x, event.y, aim, effect.length);
  }
}

import type { SpecialModule } from './types';
import type { EdgeSide, Vec2 } from '../state';

const BLOW_DIRECTION_FROM: Readonly<Record<EdgeSide, Vec2>> = {
  top: { x: 0, y: 1 },
  right: { x: -1, y: 0 },
  bottom: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
};

// Raised on the one of the bar before the gust; `src/sim/gusts.ts` blows it and ends it.
export const gust: SpecialModule = ({ state, tempo }, _enemy, effect) => {
  if (
    effect.kind !== 'gust' ||
    state.gust !== undefined ||
    !state.events.some((event) => event.type === 'bar')
  ) {
    return;
  }
  const { bar } = state.set;
  const { everyBars, from } = effect;
  if (bar % everyBars !== everyBars - 2) {
    return;
  }
  const side = from[Math.floor(bar / everyBars) % from.length];
  if (side === undefined) {
    return;
  }
  const direction = BLOW_DIRECTION_FROM[side];
  state.gust = {
    x: direction.x,
    y: direction.y,
    warnTick: state.tick,
    blowTick: state.tick + tempo.ticksPerBar,
    endTick: state.tick + 2 * tempo.ticksPerBar,
    push: effect.push,
  };
};

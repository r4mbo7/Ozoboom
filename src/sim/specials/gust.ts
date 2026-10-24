import type { SpecialModule } from './types';
import type { EdgeSide, Vec2 } from '../state';

// Where a gust blows toward, from the side it comes from.
const BLOWS: Readonly<Record<EdgeSide, Vec2>> = {
  top: { x: 0, y: 1 },
  right: { x: -1, y: 0 },
  bottom: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
};

// Every `everyBars` bars, on the one of the bar before the gust, the bad vibe raises the warning:
// `SimState.gust` says where it will blow from the next bar on (`src/sim/gusts.ts` blows it and
// ends it). It comes from the next side of `from` each time.
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
  const direction = BLOWS[side];
  state.gust = {
    x: direction.x,
    y: direction.y,
    warnTick: state.tick,
    blowTick: state.tick + tempo.ticksPerBar,
    endTick: state.tick + 2 * tempo.ticksPerBar,
    push: effect.push,
  };
};

import type { PlayerState, SimEvent, SimState } from '../sim/state';
import type { FixtureEvent } from './fixture-classes';

const ROADIE = 1;
const CARE = 2;
const TAUNT_RADIUS = 150;

function member(state: SimState, id: number): PlayerState | undefined {
  return state.players.find((player) => player.id === id);
}

function tauntedCount(state: SimState, x: number, y: number): number {
  return state.enemies.filter((enemy) => Math.hypot(enemy.x - x, enemy.y - y) <= TAUNT_RADIUS)
    .length;
}

// The classes of the V0.2 are not in the content yet: this plays their events on the fixture party,
// the roadie being its second player and the care its third.
export function advanceClassFx(
  state: SimState,
  queued: readonly FixtureEvent[],
  events: SimEvent[],
): void {
  const roadie = member(state, ROADIE);
  const care = member(state, CARE);
  if (roadie !== undefined && queued.includes('charge')) {
    events.push({ type: 'skillUsed', playerId: roadie.id });
    events.push({
      type: 'taunted',
      playerId: roadie.id,
      x: roadie.x,
      y: roadie.y,
      radius: TAUNT_RADIUS,
      count: tauntedCount(state, roadie.x, roadie.y),
    });
  }
  if (care !== undefined && queued.includes('heal')) {
    events.push({ type: 'skillUsed', playerId: care.id });
    for (const mate of state.players) {
      events.push({ type: 'playerHealed', playerId: mate.id, amount: 20 });
    }
    events.push({ type: 'coreRepaired', amount: 8 });
  }
}

import type { BarrierState, PlayerState, SimEvent, SimState } from '../sim/state';
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

function raiseCase(state: SimState, roadie: PlayerState): void {
  state.nextEntityId += 1;
  const barrier: BarrierState = {
    id: state.nextEntityId,
    playerId: roadie.id,
    x: roadie.x + roadie.aim.x * 70,
    y: roadie.y + roadie.aim.y * 70,
    radius: 80,
    hp: 60,
    ticksLeft: 240,
  };
  (state.barriers ??= []).push(barrier);
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
  if (state.barriers !== undefined) {
    for (const barrier of state.barriers) {
      barrier.ticksLeft -= 1;
    }
    state.barriers = state.barriers.filter((barrier) => barrier.ticksLeft > 0);
  }
  if (roadie !== undefined) {
    if (queued.includes('charge')) {
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
    if (queued.includes('flightCase')) {
      events.push({ type: 'ultimateUsed', playerId: roadie.id });
      raiseCase(state, roadie);
    }
  }
  const [oldest] = state.barriers ?? [];
  if (queued.includes('caseBroken') && oldest !== undefined) {
    events.push({ type: 'barrierBroken', id: oldest.id, x: oldest.x, y: oldest.y });
    state.barriers = (state.barriers ?? []).filter((barrier) => barrier !== oldest);
  }
  if (care !== undefined && (queued.includes('heal') || queued.includes('rally'))) {
    const rally = queued.includes('rally');
    events.push({ type: rally ? 'ultimateUsed' : 'skillUsed', playerId: care.id });
    for (const mate of state.players) {
      events.push({ type: 'playerHealed', playerId: mate.id, amount: rally ? 40 : 20 });
    }
    events.push({ type: 'coreRepaired', amount: rally ? 20 : 8 });
    if (rally) {
      events.push({ type: 'playerRevived', playerId: 0 });
    }
  }
}

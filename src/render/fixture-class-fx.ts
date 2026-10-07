import type { PlayerState, SimEvent, SimState } from '../sim/state';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { FixtureEvent } from './fixture-classes';

const LUXIOLE = 0;
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
// la Luxiole being its first player, the Nounours its second and l'Hygie its third. Everyone
// standing fires on every half beat.
export function advanceClassFx(
  state: SimState,
  queued: readonly FixtureEvent[],
  events: SimEvent[],
): void {
  if (state.tick % (TICKS_PER_BEAT / 2) === 0) {
    for (const player of state.players) {
      if (!player.downed) {
        const angle = Math.atan2(player.aim.y, player.aim.x);
        events.push({ type: 'playerFired', playerId: player.id, x: player.x, y: player.y, angle });
      }
    }
  }
  const luxiole = member(state, LUXIOLE);
  if (luxiole !== undefined && queued.includes('nova')) {
    events.push({ type: 'skillUsed', playerId: luxiole.id });
  }
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

import { distanceSquared } from '../../shared/vec';
import { touches } from '../effects';
import type { Circle } from '../spatial-hash';
import type { EnemyState, PickupState, SimState } from '../state';
import type { StepContext } from '../systems/types';
import type { SpecialModule, SteeringTarget } from './types';

// Squared distance below which a fleeing Arnaqueur counts as having reached the edge.
const AT_EDGE_SQUARED = 1e-6;

export const steal: SpecialModule = (ctx, enemy, effect) => {
  if (effect.kind !== 'steal') {
    return;
  }
  const { state } = ctx;
  if (enemy.fleeing === true) {
    if (distanceSquared(enemy, nearestEdgePoint(state, enemy)) <= AT_EDGE_SQUARED) {
      enemy.escaped = true;
      enemy.hp = 0;
      return;
    }
    if (state.players.some((player) => !player.downed && touches(enemy, player, player.radius))) {
      dropCarried(ctx, enemy);
    }
    return;
  }
  const pickup = nearestVibesPickup(state, enemy);
  if (pickup === undefined || !touches(enemy, pickup, 0)) {
    return;
  }
  enemy.carrying = (enemy.carrying ?? 0) + pickup.amount;
  removePickup(state, pickup);
  enemy.fleeing = true;
  state.events.push({
    type: 'vibesStolen',
    id: enemy.id,
    kind: enemy.kind,
    x: enemy.x,
    y: enemy.y,
  });
};

export const stealSteering: SteeringTarget = (ctx, enemy, effect) => {
  if (effect.kind !== 'steal') {
    return undefined;
  }
  if (enemy.fleeing === true) {
    return { target: nearestEdgePoint(ctx.state, enemy), speedMul: effect.fleeSpeedMul };
  }
  const pickup = nearestVibesPickup(ctx.state, enemy);
  return pickup === undefined ? undefined : { target: { x: pickup.x, y: pickup.y, radius: 0 } };
};

function dropCarried(ctx: StepContext, enemy: EnemyState): void {
  const { state, set } = ctx;
  const amount = enemy.carrying ?? 0;
  if (amount > 0) {
    state.pickups.push({
      id: state.nextEntityId,
      kind: 'vibes',
      amount,
      x: enemy.x,
      y: enemy.y,
      prevX: enemy.x,
      prevY: enemy.y,
      ticksLeft: set.pickups.lifetimeTicks,
    });
    state.nextEntityId += 1;
  }
  enemy.carrying = 0;
  enemy.fleeing = false;
}

function removePickup(state: SimState, pickup: PickupState): void {
  const index = state.pickups.indexOf(pickup);
  if (index !== -1) {
    state.pickups.splice(index, 1);
  }
}

function nearestVibesPickup(state: SimState, enemy: EnemyState): PickupState | undefined {
  let nearest: PickupState | undefined;
  let nearestSquared = Infinity;
  for (const pickup of state.pickups) {
    if (pickup.kind !== 'vibes') {
      continue;
    }
    const squared = distanceSquared(enemy, pickup);
    if (squared < nearestSquared) {
      nearest = pickup;
      nearestSquared = squared;
    }
  }
  return nearest;
}

// The point on the boundary where a fleeing enemy's center stops, closest to its current position.
function nearestEdgePoint(state: SimState, enemy: EnemyState): Circle {
  const { width, height } = state.arena;
  const r = enemy.radius;
  const candidates: readonly (readonly [number, Circle])[] = [
    [enemy.x - r, { x: r, y: enemy.y, radius: -r }],
    [width - r - enemy.x, { x: width - r, y: enemy.y, radius: -r }],
    [enemy.y - r, { x: enemy.x, y: r, radius: -r }],
    [height - r - enemy.y, { x: enemy.x, y: height - r, radius: -r }],
  ];
  let best = candidates[0];
  for (const candidate of candidates) {
    if (best === undefined || candidate[0] < best[0]) {
      best = candidate;
    }
  }
  if (best === undefined) {
    throw new Error('expected an edge candidate');
  }
  return best[1];
}

import { clamp } from '../../shared/scalar';
import { lookup, type ResolvedContent } from '../content';
import { gustDrift } from '../gusts';
import type { PickupState, PlayerState, SimState } from '../state';
import { statValue } from '../stats';
import { volumeMul } from '../volume';
import type { StepContext } from './types';

export function pickups({ state, content, set }: StepContext): void {
  const drift = gustDrift(state);
  let kept = 0;
  for (const pickup of state.pickups) {
    if (pickup.flight !== undefined) {
      pickup.flight.ticksLeft -= 1;
      if (pickup.flight.ticksLeft <= 0) {
        delete pickup.flight;
      }
      state.pickups[kept] = pickup;
      kept += 1;
      continue;
    }
    pickup.ticksLeft -= 1;
    if (drift !== undefined) {
      pickup.x = clamp(pickup.x + drift.x, 0, state.arena.width);
      pickup.y = clamp(pickup.y + drift.y, 0, state.arena.height);
    }
    const collector = nearestCollector(state, content, pickup);
    if (collector !== undefined && attract(pickup, collector, set.pickups.speed)) {
      collect(state, pickup, collector);
      continue;
    }
    if (pickup.ticksLeft > 0) {
      state.pickups[kept] = pickup;
      kept += 1;
    }
  }
  state.pickups.length = kept;
}

function nearestCollector(
  state: SimState,
  content: ResolvedContent,
  pickup: PickupState,
): PlayerState | undefined {
  let nearest: PlayerState | undefined;
  let nearestSquared = Infinity;
  for (const player of state.players) {
    if (player.downed) {
      continue;
    }
    const reach = statValue(
      player,
      'pickupRadiusMul',
      lookup(content.classes, player.classId, 'class').pickupRadius,
    );
    const dx = player.x - pickup.x;
    const dy = player.y - pickup.y;
    const squared = dx * dx + dy * dy;
    if (squared <= reach * reach && squared < nearestSquared) {
      nearest = player;
      nearestSquared = squared;
    }
  }
  return nearest;
}

function attract(pickup: PickupState, player: PlayerState, speed: number): boolean {
  const dx = player.x - pickup.x;
  const dy = player.y - pickup.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= player.radius + speed) {
    return true;
  }
  pickup.x += (dx / distance) * speed;
  pickup.y += (dy / distance) * speed;
  return false;
}

function collect(state: SimState, pickup: PickupState, player: PlayerState): void {
  const amount = pickup.amount * volumeMul(state);
  for (const member of state.players) {
    if (!member.downed) {
      member.vibes += amount;
    }
  }
  state.stats.vibesCollected += amount;
  state.events.push({
    type: 'pickupCollected',
    playerId: player.id,
    kind: pickup.kind,
    amount: pickup.amount,
  });
}

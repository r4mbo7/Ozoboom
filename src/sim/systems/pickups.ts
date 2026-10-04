import { lookup, type ResolvedContent } from '../content';
import type { PickupState, PlayerState, SimState } from '../state';
import type { StepContext } from './types';

// Faster than any player, so a pickup always catches the one it flies to.
export const PICKUP_SPEED = 12;

export function pickups({ state, content }: StepContext): void {
  let kept = 0;
  for (const pickup of state.pickups) {
    pickup.ticksLeft -= 1;
    const collector = nearestCollector(state, content, pickup);
    if (collector !== undefined && attract(pickup, collector)) {
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
    const reach =
      lookup(content.classes, player.classId, 'class').pickupRadius *
      (player.modifiers.pickupRadiusMul ?? 1);
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

// Moves the pickup toward the player and returns whether it reaches them this tick.
function attract(pickup: PickupState, player: PlayerState): boolean {
  const dx = player.x - pickup.x;
  const dy = player.y - pickup.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= player.radius + PICKUP_SPEED) {
    return true;
  }
  pickup.x += (dx / distance) * PICKUP_SPEED;
  pickup.y += (dy / distance) * PICKUP_SPEED;
  return false;
}

function collect(state: SimState, pickup: PickupState, player: PlayerState): void {
  if (pickup.kind === 'vibes') {
    player.vibes += pickup.amount;
    state.stats.vibesCollected += pickup.amount;
  } else {
    state.core.watts += pickup.amount;
  }
  state.events.push({
    type: 'pickupCollected',
    playerId: player.id,
    kind: pickup.kind,
    amount: pickup.amount,
  });
}

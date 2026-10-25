import type { PlayerState } from '../state';
import { statValue } from '../stats';

// The fraction of a shortened cooldown carries over, so the fire rate stays exact.
export function pullTrigger(player: PlayerState, pulled: boolean, cooldownTicks: number): boolean {
  if (player.attackCooldown > 0) {
    player.attackCooldown -= 1;
  }
  if (!pulled || player.attackCooldown > 0) {
    player.attackCooldown = Math.max(0, player.attackCooldown);
    return false;
  }
  player.attackCooldown += statValue(player, 'attackCooldownMul', cooldownTicks);
  return true;
}

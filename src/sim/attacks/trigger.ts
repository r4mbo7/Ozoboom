import type { PlayerState } from '../state';
import { statValue } from '../stats';

// The cooldown runs down on every tick; once spent, a pulled trigger fires and reloads it. The
// fractional part of a shortened cooldown carries over, so the fire rate stays exact.
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

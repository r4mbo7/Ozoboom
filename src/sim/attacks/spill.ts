import { distanceSquared } from '../../shared/vec';
import { touches } from '../effects';
import type { EnemyState, PlayerState } from '../state';
import { statValue } from '../stats';

// Each extra shot and each pierce spills a strike around the player onto one more bad vibe past its
// rim, the closest first among those `kept`; faster shots carry it further than `overflow`.
export function spilledOn(
  enemies: readonly EnemyState[],
  player: PlayerState,
  radius: number,
  overflow: number,
  kept: (enemy: EnemyState) => boolean = () => true,
): EnemyState[] {
  const count =
    Math.floor(statValue(player, 'projectileCountAdd', 0)) +
    Math.floor(statValue(player, 'pierceAdd', 0));
  if (count <= 0) {
    return [];
  }
  const reach = radius + statValue(player, 'projectileSpeedMul', overflow);
  return enemies
    .filter(
      (enemy) =>
        enemy.hp > 0 &&
        !touches(enemy, player, radius) &&
        touches(enemy, player, reach) &&
        kept(enemy),
    )
    .map((enemy) => ({ enemy, gap: distanceSquared(enemy, player) }))
    .sort((a, b) => a.gap - b.gap || a.enemy.id - b.enemy.id)
    .slice(0, count)
    .map(({ enemy }) => enemy);
}

import { BODY_YIELD } from '../data/bodies';
import type { EnemyDefinition } from '../data/types';
import { clamp } from '../shared/scalar';
import { lookup, type ResolvedContent } from './content';
import { isRooted } from './enemy-status';
import { moveUntilBlocked, resolveObstacles } from './obstacles';
import { keepAshore } from './shore';
import type { EnemyState, PlayerState } from './state';
import type { StepContext } from './systems/types';

// A player and a bad vibe never walk through each other: once both have stepped, the bad vibe gives way
// by its share of their overlap and the player takes the rest, so that he keeps that share of his speed
// as he walks into a crowd. Run after the bad vibes' steps, so that the overlaps resolved are this step's
// last ones.
export function pushBodies(ctx: StepContext): void {
  const { state, content } = ctx;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || enemy.tossed !== undefined || isRooted(enemy)) {
      continue;
    }
    for (const player of state.players) {
      if (player.downed || player.dash !== undefined || enemy.clingingTo === player.id) {
        continue;
      }
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const reach = player.radius + enemy.radius;
      if (dx * dx + dy * dy >= reach * reach) {
        continue;
      }
      const definition = lookup(content.enemies, enemy.kind, 'enemy');
      if (definition.passable !== true && !towersOver(content, player, definition)) {
        const share = enemy.isBoss ? 0 : BODY_YIELD[definition.behaviour];
        separate(ctx, player, enemy, share);
      }
    }
  }
}

export function towersOver(
  content: ResolvedContent,
  player: PlayerState,
  definition: EnemyDefinition,
): boolean {
  return content.classes.get(player.classId)?.towersOver?.includes(definition.behaviour) === true;
}

function overlap(player: PlayerState, enemy: EnemyState): number {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  return player.radius + enemy.radius - Math.sqrt(dx * dx + dy * dy);
}

// Neither body moves more than the player's step, so that one landing deep in the other works its way out
// over a few steps instead of jumping.
function separate(ctx: StepContext, player: PlayerState, enemy: EnemyState, share: number): void {
  const { arena } = ctx.state;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const nx = distance === 0 ? 1 : dx / distance;
  const ny = distance === 0 ? 0 : dy / distance;
  const step = player.speed;
  const give = Math.min((player.radius + enemy.radius - distance) * share, step);
  if (give > 0) {
    moveUntilBlocked(enemy, -nx * give, -ny * give, ctx.enemyObstacles);
    enemy.x = clamp(enemy.x, enemy.radius, arena.width - enemy.radius);
    enemy.y = clamp(enemy.y, enemy.radius, arena.height - enemy.radius);
  }
  const rest = Math.min(overlap(player, enemy), step);
  if (rest > 0) {
    const fromX = player.x;
    const fromY = player.y;
    player.x = clamp(player.x + nx * rest, player.radius, arena.width - player.radius);
    player.y = clamp(player.y + ny * rest, player.radius, arena.height - player.radius);
    resolveObstacles(player, fromX, fromY, ctx.obstacles);
    keepAshore(ctx.shore, player);
  }
}

import { length, normalize } from '../../shared/vec';
import { IDLE_INPUT } from '../commands';
import { resolveObstacles } from '../obstacles';
import type { Vec2 } from '../state';
import type { StepContext } from './types';

export function playerMovement({ state, set, commands }: StepContext): void {
  const { arena } = state;
  const obstacles = set.obstacles ?? [];
  for (const player of state.players) {
    if (player.downed) {
      continue;
    }
    if (player.dash?.ticksLeft === 0) {
      delete player.dash;
    }
    const input = commands.get(player.id)?.input ?? IDLE_INPUT;
    const { dx, dy } = player.dash ?? walk(input.move, player.speed * (player.slowFactor ?? 1));
    const fromX = player.x;
    const fromY = player.y;
    player.x = clamp(player.x + dx, player.radius, arena.width - player.radius);
    player.y = clamp(player.y + dy, player.radius, arena.height - player.radius);
    if (player.dash !== undefined) {
      player.dash.ticksLeft -= 1;
    }
    resolveObstacles(player, fromX, fromY, obstacles);
    const aim = normalize(input.aim);
    if (aim.x !== 0 || aim.y !== 0) {
      player.aim = aim;
    }
  }
}

function walk(move: Vec2, speed: number): { dx: number; dy: number } {
  const direction = length(move) > 1 ? normalize(move) : move;
  return { dx: direction.x * speed, dy: direction.y * speed };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

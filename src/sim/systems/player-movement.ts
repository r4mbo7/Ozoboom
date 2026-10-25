import { clamp } from '../../shared/scalar';
import { length, normalize } from '../../shared/vec';
import { IDLE_INPUT } from '../commands';
import { gustDrift } from '../gusts';
import { resolveObstacles } from '../obstacles';
import type { Vec2 } from '../state';
import type { StepContext } from './types';

export function playerMovement({ state, set, content, commands }: StepContext): void {
  const { arena } = state;
  const obstacles = set.obstacles ?? [];
  const drift = gustDrift(state) ?? { x: 0, y: 0 };
  for (const player of state.players) {
    if (player.downed) {
      continue;
    }
    const gustMul = content.classes.get(player.classId)?.gustMul ?? 1;
    if (player.dash?.ticksLeft === 0) {
      delete player.dash;
    }
    const input = commands.get(player.id)?.input ?? IDLE_INPUT;
    const { dx, dy } = player.dash ?? walk(input.move, player.speed * (player.slowFactor ?? 1));
    const fromX = player.x;
    const fromY = player.y;
    player.x = clamp(player.x + dx + drift.x * gustMul, player.radius, arena.width - player.radius);
    player.y = clamp(
      player.y + dy + drift.y * gustMul,
      player.radius,
      arena.height - player.radius,
    );
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

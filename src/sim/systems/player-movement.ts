import { length, normalize } from '../../shared/vec';
import { IDLE_INPUT } from '../commands';
import type { StepContext } from './types';

export function playerMovement({ state, commands }: StepContext): void {
  const { arena } = state;
  for (const player of state.players) {
    if (player.downed) {
      continue;
    }
    const input = commands.get(player.id)?.input ?? IDLE_INPUT;
    const direction = length(input.move) > 1 ? normalize(input.move) : input.move;
    player.x = clamp(
      player.x + direction.x * player.speed,
      player.radius,
      arena.width - player.radius,
    );
    player.y = clamp(
      player.y + direction.y * player.speed,
      player.radius,
      arena.height - player.radius,
    );
    const aim = normalize(input.aim);
    if (aim.x !== 0 || aim.y !== 0) {
      player.aim = aim;
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

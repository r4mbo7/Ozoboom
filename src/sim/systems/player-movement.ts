import { turnToward } from '../../shared/angle';
import { clamp } from '../../shared/scalar';
import { TICK_RATE_HZ } from '../../shared/tempo';
import { length, normalize } from '../../shared/vec';
import { IDLE_INPUT } from '../commands';
import { gustDrift } from '../gusts';
import { resolveObstacles } from '../obstacles';
import type { Vec2 } from '../state';
import { holdsItsPlayer } from '../walls';
import type { StepContext } from './types';

// A player turns fast but never at once: half a turn takes this long, so that a swing or a jet sweeps
// round rather than jumping to his other side.
const HALF_TURN_SECONDS = 0.2;
const MAX_TURN_PER_TICK = Math.PI / (HALF_TURN_SECONDS * TICK_RATE_HZ);

export function playerMovement({ state, content, commands, obstacles }: StepContext): void {
  const { arena } = state;
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
    const aim = normalize(input.aim);
    if (aim.x !== 0 || aim.y !== 0) {
      player.aim = turnToward(player.aim, aim, MAX_TURN_PER_TICK);
    }
    if (holdsItsPlayer(state, player)) {
      delete player.dash;
      continue;
    }
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
  }
}

function walk(move: Vec2, speed: number): { dx: number; dy: number } {
  const direction = length(move) > 1 ? normalize(move) : move;
  return { dx: direction.x * speed, dy: direction.y * speed };
}

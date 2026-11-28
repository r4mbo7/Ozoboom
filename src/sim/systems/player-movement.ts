import { turnToward } from '../../shared/angle';
import { clamp } from '../../shared/scalar';
import { TICK_RATE_HZ } from '../../shared/tempo';
import { length, normalize } from '../../shared/vec';
import { IDLE_INPUT } from '../commands';
import { gustDrift } from '../gusts';
import { resolveObstacles } from '../obstacles';
import { walkSlow } from '../potion-shield';
import { keepAshore } from '../shore';
import type { PlayerState, Vec2 } from '../state';
import { holdsItsPlayer } from '../walls';
import type { StepContext } from './types';

// A player turns fast but never at once: half a turn takes this long, so that a swing or a jet sweeps
// round rather than jumping to his other side.
const HALF_TURN_SECONDS = 0.2;
const MAX_TURN_PER_TICK = Math.PI / (HALF_TURN_SECONDS * TICK_RATE_HZ);
// From rest a player is at full speed in this many ticks, and stops in that many once the stick is let go
// or points against the motion: the start stays instant, the stop settles instead of dying dead.
const ACCEL_TICKS = 1;
const BRAKE_TICKS = 2;

export function playerMovement({ state, content, commands, obstacles, shore }: StepContext): void {
  const { arena } = state;
  const drift = gustDrift(state) ?? { x: 0, y: 0 };
  for (const player of state.players) {
    if (player.downed) {
      delete player.walk;
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
      delete player.walk;
      continue;
    }
    steerWalk(player, input.move);
    const dx = player.dash === undefined ? (player.walk?.x ?? 0) : player.dash.dx;
    const dy = player.dash === undefined ? (player.walk?.y ?? 0) : player.dash.dy;
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
    keepAshore(shore, player);
  }
}

// The walking velocity moves toward the stick by at most a step of the player's speed over its ticks, and
// lands on it once within reach. It keeps going under a dash, so that a dash ends at the walk of the stick.
function steerWalk(player: PlayerState, move: Vec2): void {
  if (player.walk === undefined && move.x === 0 && move.y === 0) {
    return;
  }
  const direction = length(move) > 1 ? normalize(move) : move;
  const speed = player.speed * walkSlow(player);
  const targetX = direction.x * speed;
  const targetY = direction.y * speed;
  const vx = player.walk?.x ?? 0;
  const vy = player.walk?.y ?? 0;
  const idle = direction.x === 0 && direction.y === 0;
  const braking = idle || targetX * vx + targetY * vy < 0;
  const rate = player.speed / (braking ? BRAKE_TICKS : ACCEL_TICKS);
  const dx = targetX - vx;
  const dy = targetY - vy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const arrives = distance <= rate;
  const share = rate / distance;
  const x = arrives ? targetX : vx + dx * share;
  const y = arrives ? targetY : vy + dy * share;
  if (x === 0 && y === 0) {
    delete player.walk;
  } else {
    player.walk = { x, y };
  }
}

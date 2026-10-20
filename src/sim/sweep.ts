import { rotate } from '../shared/angle';
import type { Vec2 } from '../shared/vec';

// Every sweep starts its period at the same end, so the traps that share a period sweep together.
export function sweptDirection(
  facing: Vec2,
  sweepDegrees: number,
  tick: number,
  periodTicks: number,
): Vec2 {
  const cycles = tick / periodTicks;
  const phase = cycles - Math.floor(cycles);
  const travel = phase < 0.5 ? 2 * phase : 2 - 2 * phase;
  const eased = travel * travel * (3 - 2 * travel);
  return rotate(facing, ((eased - 0.5) * sweepDegrees * Math.PI) / 180);
}

import { rotate } from '../shared/angle';
import { frac, smoothstep } from '../shared/scalar';
import type { Vec2 } from '../shared/vec';

// Every sweep starts its period at the same end, so the traps that share a period sweep together.
export function sweptDirection(
  facing: Vec2,
  sweepDegrees: number,
  tick: number,
  periodTicks: number,
): Vec2 {
  const phase = frac(tick / periodTicks);
  const travel = phase < 0.5 ? 2 * phase : 2 - 2 * phase;
  return rotate(facing, ((smoothstep(travel) - 0.5) * sweepDegrees * Math.PI) / 180);
}

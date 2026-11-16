import type { SetDefinition } from '../data/types';
import { compound } from './effects';

// A factor that grows by `mul` for each player past the first; absent means 1 whatever the team.
export function teamMul(mul: number | undefined, teamSize: number): number {
  return 1 + (mul ?? 0) * (teamSize - 1);
}

// Each player gets every vibe of a team that brings `spawnMul` more bad vibes per player: the threshold
// grows as much, so a team levels up at the pace of a player alone. Rounded to a whole vibe, so the
// level ring shows the exact threshold whatever the curve.
export function vibesToReach(set: SetDefinition, level: number, teamSize: number): number {
  const { baseVibes, vibesPerLevel, growth = 1 } = set.levelCurve;
  const vibes = Math.floor(
    (baseVibes + vibesPerLevel * (level - 1)) *
      compound(growth, level - 1) *
      teamMul(set.perPlayer?.spawnMul, teamSize) +
      0.5,
  );
  if (!(vibes > 0)) {
    throw new RangeError(`set "${set.id}" asks ${String(vibes)} vibes for level ${String(level)}`);
  }
  return vibes;
}

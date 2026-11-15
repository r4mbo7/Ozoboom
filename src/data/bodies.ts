import type { EnemyBehaviour } from './types';

// The share of an overlap a bad vibe gives way when a player walks into it: the player keeps that share
// of his speed against it, and each other bad vibe he touches slows him again. At 0 the body is solid,
// the player slides along it.
export const BODY_YIELD: Readonly<Record<EnemyBehaviour, number>> = {
  rusher: 0.4,
  horde: 0.4,
  shooter: 0.4,
  heavy: 0,
  boss: 0,
};

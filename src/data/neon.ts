import { TICKS_PER_BEAT } from '../shared/tempo';
import type { EnemyDefinition } from './types';

// Chased, it unmasks: a dancer stays where it fell, in a pool of light `trackRadius` wide, and
// lobs a vibe of `vibesPerBar` onto its rim on each bar. The bad vibes within `lureRadius` of him
// leave the core for him; each hit brings his mask a notch closer, a zone heal a notch back, and at
// `notches` it snaps back on and bursts: he leaves `burst.pieces` vibes of `burst.vibes` around him.
export interface UnmaskEffect {
  readonly kind: 'unmask';
  readonly trackRadius: number;
  readonly lureRadius: number;
  readonly notches: number;
  readonly vibesPerBar: number;
  readonly burst: { readonly pieces: number; readonly vibes: number };
}

export const NEON: EnemyDefinition = {
  id: 'neon',
  name: 'Le Néon',
  description: 'Chasse-le : sous son masque, un danseur qui lance des vibes, à protéger.',
  behaviour: 'horde',
  maxHp: 60,
  speed: 1.2,
  radius: 13,
  damage: 3,
  attackCooldownTicks: 2 * TICKS_PER_BEAT,
  aggroRadius: 90,
  vibesDrop: 3,
  scalingPerPhrase: { hp: 1.1, speed: 1.02 },
  oneAtATime: true,
  special: {
    kind: 'unmask',
    trackRadius: 64,
    lureRadius: 180,
    notches: 3,
    vibesPerBar: 2,
    burst: { pieces: 5, vibes: 2 },
  },
};

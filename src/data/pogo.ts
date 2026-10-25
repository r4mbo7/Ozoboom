import { TICKS_PER_BEAT } from '../shared/tempo';
import type { EnemyDefinition } from './types';

export interface MoshRingEffect {
  readonly kind: 'moshRing';
  readonly reach: number;
  readonly orbit: number;
}

export const POGO: EnemyDefinition = {
  id: 'pogo',
  name: 'Le Pogo',
  description: 'Il enrôle les bad vibes en ronde autour de lui : elles prennent les coups.',
  behaviour: 'boss',
  maxHp: 2000,
  speed: 0.75,
  radius: 42,
  damage: 30,
  attackCooldownTicks: 2 * TICKS_PER_BEAT,
  aggroRadius: 320,
  vibesDrop: 50,
  scalingPerPhrase: { hp: 1, speed: 1 },
  special: { kind: 'moshRing', reach: 260, orbit: 66 },
};

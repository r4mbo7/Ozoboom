import { TICKS_PER_BEAT } from '../shared/tempo';
import type { EdgeSide, EnemyDefinition } from './types';

export interface GustEffect {
  readonly kind: 'gust';
  readonly everyBars: number;
  readonly push: number;
  readonly from: readonly EdgeSide[];
}

export const COUP_DE_VENT: EnemyDefinition = {
  id: 'coup-de-vent',
  name: 'Le Coup de vent',
  description: 'Il souffle, et tout ce qui est léger dérive.',
  behaviour: 'boss',
  maxHp: 2000,
  speed: 0.8,
  radius: 44,
  damage: 30,
  attackCooldownTicks: 2 * TICKS_PER_BEAT,
  aggroRadius: 320,
  vibesDrop: 50,
  scalingPerPhrase: { hp: 1, speed: 1 },
  special: {
    kind: 'gust',
    everyBars: 4,
    push: 3,
    from: ['top', 'right', 'bottom', 'left'],
  },
};

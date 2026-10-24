import { TICKS_PER_BEAT } from '../shared/tempo';
import type { EdgeSide, EnemyDefinition } from './types';

// Every `everyBars` bars, a gust of one bar, announced the bar before: it drifts the players and
// the vibes on the floor by `push` a tick at full blow, never the bad vibes. It blows from one
// side of the floor to the other, the next gust from the next side of `from`.
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

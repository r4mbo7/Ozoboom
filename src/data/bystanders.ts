import { TICKS_PER_BAR } from '../shared/tempo';
import type { BystanderDefinition } from './types';

export const BYSTANDERS: readonly BystanderDefinition[] = [
  {
    id: 'festivalier-en-detresse',
    name: 'The Raver in Distress',
    description: 'They’re not doing well: stay by their side for a bar to help them.',
    radius: 11,
    speed: 1,
    helpTicks: TICKS_PER_BAR,
    vibesReward: 8,
    vibesPenalty: 4,
    lifetimeBars: 4,
  },
];

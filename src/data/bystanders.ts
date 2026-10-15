import { TICKS_PER_BAR } from '../shared/tempo';
import type { BystanderDefinition } from './types';

export const BYSTANDERS: readonly BystanderDefinition[] = [
  {
    id: 'festivalier-en-detresse',
    name: 'Le Festivalier en détresse',
    description: "Il ne va pas bien : reste à son contact une mesure pour l'aider.",
    radius: 11,
    speed: 1,
    helpTicks: TICKS_PER_BAR,
    vibesReward: 8,
    vibesPenalty: 4,
    lifetimeBars: 4,
  },
];

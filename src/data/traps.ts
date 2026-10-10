import type { TrapDefinition } from './types';

export const TRAPS: readonly TrapDefinition[] = [
  {
    id: 'caisson-de-basse',
    name: 'Caisson de basse',
    description: 'Envoie une onde de basse sur chaque temps et repousse les bad vibes.',
    radius: 18,
    hp: 60,
    cadence: 'beat',
    effect: { kind: 'shockwave', damage: 6, radius: 110, knockback: 24 },
  },
  {
    id: 'laser',
    name: 'Laser',
    description: 'Trace une ligne de lumière continue qui dissout les bad vibes.',
    radius: 14,
    hp: 40,
    cadence: 'continuous',
    effect: { kind: 'beam', damagePerTick: 1, length: 360, width: 12 },
  },
];

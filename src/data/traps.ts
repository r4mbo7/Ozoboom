import type { TrapDefinition } from './types';

export const TRAPS: readonly TrapDefinition[] = [
  {
    id: 'caisson-de-basse',
    name: 'Caisson de basse',
    description: 'Envoie une onde de basse sur chaque temps et repousse les bad vibes.',
    radius: 18,
    cadence: 'beat',
    effect: { kind: 'shockwave', damage: 5, radius: 75, knockback: 8 },
    lootWeight: 3,
  },
  {
    id: 'laser',
    name: 'Laser',
    description: "Balaie un arc d'une ligne de lumière qui dissout les bad vibes.",
    radius: 14,
    cadence: 'continuous',
    effect: { kind: 'beam', damagePerTick: 2, length: 360, width: 12, sweepDegrees: 90 },
    lootWeight: 2,
  },
  {
    id: 'ventilateur-brumisant',
    name: 'Ventilateur brumisant',
    description:
      'Souffle un cône de brume qui balaie la piste, soigne sur chaque temps et ralentit les bad vibes.',
    radius: 16,
    cadence: 'continuous',
    effect: {
      kind: 'breeze',
      slowFactor: 0.7,
      healPerBeat: 3,
      length: 200,
      coneDegrees: 50,
      sweepDegrees: 90,
    },
    lootWeight: 0.1,
  },
];

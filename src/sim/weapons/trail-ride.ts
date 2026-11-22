import type { StatModifier, WeaponEffect } from '../../data/types';

type TrailEffect = Extract<WeaponEffect, { kind: 'trail' }>;

// The speed a trail prop gives its rider once it lays its trail.
export const trailRide = (effect: TrailEffect): readonly StatModifier[] => [
  { stat: 'speedMul', mul: effect.speedMul },
];

// What a trail prop fused away takes back of its rider's speed.
export const trailDismount = (effect: TrailEffect): readonly StatModifier[] => [
  { stat: 'speedMul', mul: 1 / effect.speedMul },
];

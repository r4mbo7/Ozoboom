import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import type { ClassDefinition } from './types';

export const CLASSES: readonly ClassDefinition[] = [
  {
    id: 'mage',
    name: 'La VJ',
    role: 'Mage : dégâts de zone à distance, fragile.',
    color: '#ff2bd6',
    maxHp: 80,
    speed: 7.5,
    radius: 14,
    pickupRadius: 80,
    attack: {
      damage: 10,
      cooldownTicks: TICKS_PER_BEAT / 2,
      projectileSpeed: 16,
      projectileRadius: 6,
      rangeTicks: 30,
      pierce: 0,
      count: 1,
      spreadRadians: 0.2,
    },
    skill: {
      id: 'nova',
      name: 'Nova',
      description: 'Tu libères une onde de lumière qui repousse les bad vibes autour de toi.',
      cooldownTicks: 4 * TICKS_PER_BAR,
      effect: { kind: 'nova', damage: 40, radius: 150, knockback: 60 },
    },
    ultimate: {
      id: 'laser-show',
      name: 'Laser show',
      description: 'Sur le drop, tu balaies la piste de lasers pendant deux mesures.',
      cooldownTicks: 0,
      effect: {
        kind: 'laserShow',
        damagePerTick: 3,
        radius: 300,
        durationTicks: 2 * TICKS_PER_BAR,
      },
    },
  },
];

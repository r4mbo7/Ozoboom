import { TICKS_PER_BAR } from '../shared/tempo';
import type { ClassDefinition, UpgradeDefinition } from './types';

export interface AuraAttack {
  kind: 'aura';
  damage: number;
  radius: number;
  // How far past its rim the good mood spills onto the bad vibes that extra shots or pierce add.
  overflow: number;
  kiff: { perChase: number; perHp: number; radiusPerNotch: number; ratePerNotch: number };
}

export interface OlaEffect {
  kind: 'ola';
  damage: number;
  damageReach: number;
  reach: number;
  beats: number;
  slowBeats: number;
  boostMul: number;
  boostBars: number;
}

export const KIFFEUR: ClassDefinition = {
  id: 'kiffeur',
  name: 'The Reveler',
  role: 'Doesn’t aim, just dances: their good mood hits all around them and makes everyone fire faster.',
  color: '#f5e663',
  maxHp: 150,
  speed: 7.2,
  radius: 14,
  pickupRadius: 160,
  attack: {
    kind: 'aura',
    damage: 16,
    radius: 90,
    overflow: 60,
    kiff: { perChase: 0.07, perHp: 0.02, radiusPerNotch: 15, ratePerNotch: 0.1 },
  },
  skill: {
    id: 'ola',
    name: 'Wave',
    description:
      'A wave leaves you, slows the bad vibes and makes the whole team run and fire faster.',
    cooldownTicks: 4 * TICKS_PER_BAR,
    effect: {
      kind: 'ola',
      damage: 20,
      damageReach: 240,
      reach: 720,
      beats: 4,
      slowBeats: 2,
      boostMul: 1.25,
      boostBars: 1,
    },
  },
  gauge: { kind: 'kiff', name: 'Bliss', max: 3 },
  affinityWeaponIds: ['assiettes-chinoises'],
  excludedWeaponIds: ['cerceaux'],
};

export const KIFFEUR_UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'eclats-de-rire',
    name: 'Belly Laughs',
    description: 'Your Bliss makes your good mood hit harder.',
    family: 'class',
    classId: 'kiffeur',
    modifiers: [{ stat: 'kiffDamageAdd', add: 0.15 }],
    rarities: {
      rare: {
        description: 'Your Bliss makes your good mood hit a lot harder.',
        modifiers: [{ stat: 'kiffDamageAdd', add: 0.25 }],
      },
      legendary: {
        description: 'Your Bliss at max doubles the power of your good mood.',
        modifiers: [{ stat: 'kiffDamageAdd', add: 0.35 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'bras-grands-ouverts',
    name: 'Arms Wide Open',
    description: 'Your aura widens.',
    family: 'class',
    classId: 'kiffeur',
    modifiers: [{ stat: 'attackRadiusMul', mul: 1.2 }],
    rarities: {
      rare: {
        description: 'Your aura widens a lot.',
        modifiers: [{ stat: 'attackRadiusMul', mul: 1.4 }],
      },
      legendary: {
        description: 'Your aura grows by half.',
        modifiers: [{ stat: 'attackRadiusMul', mul: 1.5 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'ola-dechainee',
    name: 'Tidal Wave',
    description: 'Your wave hits harder.',
    family: 'class',
    classId: 'kiffeur',
    modifiers: [{ stat: 'skillPowerMul', mul: 1.55 }],
    rarities: {
      rare: {
        description: 'Your wave hits twice as hard.',
        modifiers: [{ stat: 'skillPowerMul', mul: 2.25 }],
      },
      legendary: {
        description: 'Your wave hits three times as hard.',
        modifiers: [{ stat: 'skillPowerMul', mul: 3 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'ola-sans-fin',
    name: 'Endless Wave',
    description: 'Your special comes back faster.',
    family: 'class',
    classId: 'kiffeur',
    modifiers: [{ stat: 'skillCooldownMul', mul: 0.64 }],
    rarities: {
      rare: {
        description: 'Your special comes back much faster.',
        modifiers: [{ stat: 'skillCooldownMul', mul: 0.36 }],
      },
      legendary: {
        description: 'Your special comes back almost at once.',
        modifiers: [{ stat: 'skillCooldownMul', mul: 0.16 }],
      },
    },
    maxStacks: 2,
  },
];

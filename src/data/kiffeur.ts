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
  name: 'Le Kiffeur',
  role: 'Ne vise pas, il danse : sa bonne humeur frappe tout autour de lui et fait tirer plus vite.',
  color: '#f5e663',
  maxHp: 140,
  speed: 7.2,
  radius: 14,
  pickupRadius: 160,
  attack: {
    kind: 'aura',
    damage: 16,
    radius: 90,
    overflow: 60,
    kiff: { perChase: 0.125, perHp: 0.02, radiusPerNotch: 15, ratePerNotch: 0.1 },
  },
  skill: {
    id: 'ola',
    name: 'Ola',
    description:
      'Une vague part de toi, ralentit les bad vibes et fait courir et tirer plus vite toute l’équipe.',
    cooldownTicks: 4 * TICKS_PER_BAR,
    effect: {
      kind: 'ola',
      damage: 25,
      damageReach: 240,
      reach: 720,
      beats: 4,
      slowBeats: 2,
      boostMul: 1.5,
      boostBars: 1,
    },
  },
  gauge: { kind: 'kiff', name: 'Kiff', max: 3 },
  affinityWeaponIds: ['assiettes-chinoises'],
  excludedWeaponIds: ['cerceaux'],
};

export const KIFFEUR_UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'eclats-de-rire',
    name: 'Éclats de rire',
    description: 'Ton Kiff fait frapper ta bonne humeur plus fort.',
    family: 'class',
    classId: 'kiffeur',
    modifiers: [{ stat: 'kiffDamageAdd', add: 0.15 }],
    rarities: {
      rare: {
        description: 'Ton Kiff fait frapper ta bonne humeur nettement plus fort.',
        modifiers: [{ stat: 'kiffDamageAdd', add: 0.25 }],
      },
      legendary: {
        description: 'Ton Kiff au max double la force de ta bonne humeur.',
        modifiers: [{ stat: 'kiffDamageAdd', add: 0.35 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'bras-grands-ouverts',
    name: 'Bras grands ouverts',
    description: 'Ton aura s’élargit.',
    family: 'class',
    classId: 'kiffeur',
    modifiers: [{ stat: 'attackRadiusMul', mul: 1.2 }],
    rarities: {
      rare: {
        description: 'Ton aura s’élargit nettement.',
        modifiers: [{ stat: 'attackRadiusMul', mul: 1.4 }],
      },
      legendary: {
        description: 'Ton aura s’étend de moitié.',
        modifiers: [{ stat: 'attackRadiusMul', mul: 1.5 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'ola-dechainee',
    name: 'Ola déchaînée',
    description: 'Ta Ola frappe plus fort.',
    family: 'class',
    classId: 'kiffeur',
    modifiers: [{ stat: 'skillPowerMul', mul: 1.55 }],
    rarities: {
      rare: {
        description: 'Ta Ola frappe deux fois plus fort.',
        modifiers: [{ stat: 'skillPowerMul', mul: 2.25 }],
      },
      legendary: {
        description: 'Ta Ola frappe trois fois plus fort.',
        modifiers: [{ stat: 'skillPowerMul', mul: 3 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'ola-sans-fin',
    name: 'Ola sans fin',
    description: 'Ta spéciale revient plus vite.',
    family: 'class',
    classId: 'kiffeur',
    modifiers: [{ stat: 'skillCooldownMul', mul: 0.64 }],
    rarities: {
      rare: {
        description: 'Ta spéciale revient bien plus vite.',
        modifiers: [{ stat: 'skillCooldownMul', mul: 0.36 }],
      },
      legendary: {
        description: 'Ta spéciale revient presque aussitôt.',
        modifiers: [{ stat: 'skillCooldownMul', mul: 0.16 }],
      },
    },
    maxStacks: 2,
  },
];

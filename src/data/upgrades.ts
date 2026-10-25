import { FULL_UPGRADES } from './full';
import { KIFFEUR_UPGRADES } from './kiffeur';
import type { RarityWeights, UpgradeDefinition } from './types';

export const RARITY_WEIGHTS: readonly RarityWeights[] = [
  { common: 100, rare: 0, legendary: 0 },
  { common: 100, rare: 0, legendary: 0 },
  { common: 75, rare: 25, legendary: 0 },
  { common: 70, rare: 25, legendary: 5 },
  { common: 60, rare: 30, legendary: 10 },
];

export const UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'double-faisceau',
    name: 'Double faisceau',
    description: 'Tu tires deux projectiles de plus.',
    family: 'class',
    classId: 'mage',
    modifiers: [{ stat: 'projectileCountAdd', add: 2 }],
    rarities: {
      rare: {
        description: 'Tu tires quatre projectiles de plus.',
        modifiers: [{ stat: 'projectileCountAdd', add: 4 }],
      },
      legendary: {
        description: 'Tu tires six projectiles de plus.',
        modifiers: [{ stat: 'projectileCountAdd', add: 6 }],
      },
    },
    maxStacks: 1,
  },
  {
    id: 'lumiere-traversante',
    name: 'Lumière traversante',
    description: 'Tes tirs traversent deux bad vibes de plus.',
    family: 'class',
    classId: 'mage',
    modifiers: [{ stat: 'pierceAdd', add: 2 }],
    rarities: {
      rare: {
        description: 'Tes tirs traversent quatre bad vibes de plus.',
        modifiers: [{ stat: 'pierceAdd', add: 4 }],
      },
      legendary: {
        description: 'Tes tirs traversent six bad vibes de plus.',
        modifiers: [{ stat: 'pierceAdd', add: 6 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'nova-xxl',
    name: 'Spéciale XXL',
    description: 'Ta spéciale frappe plus fort.',
    family: 'class',
    classId: 'mage',
    modifiers: [{ stat: 'skillPowerMul', mul: 1.55 }],
    rarities: {
      rare: {
        description: 'Ta spéciale frappe deux fois plus fort.',
        modifiers: [{ stat: 'skillPowerMul', mul: 2.25 }],
      },
      legendary: {
        description: 'Ta spéciale frappe trois fois plus fort.',
        modifiers: [{ stat: 'skillPowerMul', mul: 3 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'boucle-vj',
    name: 'Boucle VJ',
    description: 'Ta spéciale revient plus vite.',
    family: 'class',
    classId: 'mage',
    modifiers: [{ stat: 'skillCooldownMul', mul: 0.64 }],
    rarities: {
      rare: {
        description: 'Ta spéciale revient bien plus vite.',
        modifiers: [{ stat: 'skillCooldownMul', mul: 0.36 }],
      },
      legendary: {
        description: 'Ta spéciale revient presque en continu.',
        modifiers: [{ stat: 'skillCooldownMul', mul: 0.16 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'jambes-de-danseur',
    name: 'Jambes de danseur',
    description: 'Tu te déplaces plus vite.',
    family: 'generic',
    modifiers: [{ stat: 'speedMul', mul: 1.2 }],
    rarities: {
      rare: {
        description: 'Tu te déplaces nettement plus vite.',
        modifiers: [{ stat: 'speedMul', mul: 1.45 }],
      },
      legendary: {
        description: 'Tu te déplaces bien plus vite.',
        modifiers: [{ stat: 'speedMul', mul: 1.7 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'deuxieme-souffle',
    name: 'Deuxième souffle',
    description: 'Tu gagnes 40 points de vie maximum.',
    family: 'generic',
    modifiers: [{ stat: 'maxHpAdd', add: 40 }],
    rarities: {
      rare: {
        description: 'Tu gagnes 80 points de vie maximum.',
        modifiers: [{ stat: 'maxHpAdd', add: 80 }],
      },
      legendary: {
        description: 'Tu gagnes 120 points de vie maximum.',
        modifiers: [{ stat: 'maxHpAdd', add: 120 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'bonnes-ondes',
    name: 'Bonnes ondes',
    description: 'Tu attires les vibes de plus loin.',
    family: 'generic',
    modifiers: [{ stat: 'pickupRadiusMul', mul: 1.7 }],
    rarities: {
      rare: {
        description: 'Tu attires les vibes de bien plus loin.',
        modifiers: [{ stat: 'pickupRadiusMul', mul: 2.5 }],
      },
      legendary: {
        description: 'Tu attires les vibes de très loin.',
        modifiers: [{ stat: 'pickupRadiusMul', mul: 3.6 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'baskets-legeres',
    name: 'Baskets légères',
    description: 'Ton dash revient plus vite.',
    family: 'generic',
    modifiers: [{ stat: 'dashRechargeMul', mul: 0.75 }],
    rarities: {
      rare: {
        description: 'Ton dash revient nettement plus vite.',
        modifiers: [{ stat: 'dashRechargeMul', mul: 0.5 }],
      },
      legendary: {
        description: 'Ton dash revient bien plus vite.',
        modifiers: [{ stat: 'dashRechargeMul', mul: 0.375 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'pas-chasse',
    name: 'Pas chassé',
    description: 'Tu peux enchaîner un dash de plus.',
    family: 'generic',
    modifiers: [{ stat: 'dashChargesAdd', add: 1 }],
    rarities: {
      rare: {
        description: 'Tu peux enchaîner deux dashs de plus.',
        modifiers: [{ stat: 'dashChargesAdd', add: 2 }],
      },
      legendary: {
        description: 'Tu peux enchaîner trois dashs de plus.',
        modifiers: [{ stat: 'dashChargesAdd', add: 3 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'volume-a-fond',
    name: 'Volume à fond',
    description: 'Tes tirs font plus de dégâts.',
    family: 'generic',
    modifiers: [{ stat: 'damageMul', mul: 1.3 }],
    rarities: {
      rare: {
        description: 'Tes tirs font nettement plus de dégâts.',
        modifiers: [{ stat: 'damageMul', mul: 1.7 }],
      },
      legendary: {
        description: 'Tes tirs font deux fois plus de dégâts.',
        modifiers: [{ stat: 'damageMul', mul: 2.1 }],
      },
    },
    maxStacks: 3,
  },
  {
    id: 'double-tempo',
    name: 'Double tempo',
    description: 'Tu tires plus souvent.',
    family: 'generic',
    modifiers: [{ stat: 'attackCooldownMul', mul: 0.77 }],
    rarities: {
      rare: {
        description: 'Tu tires nettement plus souvent.',
        modifiers: [{ stat: 'attackCooldownMul', mul: 0.58 }],
      },
      legendary: {
        description: 'Tu tires bien plus souvent.',
        modifiers: [{ stat: 'attackCooldownMul', mul: 0.41 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'sub-renforce',
    name: 'Sub renforcé',
    description: 'Tes pièges font plus de dégâts.',
    family: 'defense',
    modifiers: [{ stat: 'trapDamageMul', mul: 1.45 }],
    rarities: {
      rare: {
        description: 'Tes pièges font deux fois plus de dégâts.',
        modifiers: [{ stat: 'trapDamageMul', mul: 2 }],
      },
      legendary: {
        description: 'Tes pièges font deux fois et demie plus de dégâts.',
        modifiers: [{ stat: 'trapDamageMul', mul: 2.5 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'talkie-walkie',
    name: 'Talkie-walkie',
    description: 'Tu fais venir les porteurs de loot plus souvent.',
    family: 'defense',
    modifiers: [{ stat: 'lootIntervalMul', mul: 0.72 }],
    rarities: {
      rare: {
        description: 'Tu fais venir les porteurs de loot deux fois plus souvent.',
        modifiers: [{ stat: 'lootIntervalMul', mul: 0.5 }],
      },
      legendary: {
        description: 'Tu fais venir les porteurs de loot trois fois plus souvent.',
        modifiers: [{ stat: 'lootIntervalMul', mul: 0.3 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'banane',
    name: 'Banane',
    description: 'Tu ramasses les loots de plus loin.',
    family: 'defense',
    modifiers: [{ stat: 'lootRadiusMul', mul: 2.2 }],
    rarities: {
      rare: {
        description: 'Tu ramasses les loots de bien plus loin.',
        modifiers: [{ stat: 'lootRadiusMul', mul: 4 }],
      },
      legendary: {
        description: 'Tu ramasses les loots de très loin.',
        modifiers: [{ stat: 'lootRadiusMul', mul: 9 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'rallonge',
    name: 'Rallonge',
    description: 'Tu peux poser deux pièges de plus.',
    family: 'defense',
    modifiers: [{ stat: 'trapSlotsAdd', add: 2 }],
    rarities: {
      rare: {
        description: 'Tu peux poser quatre pièges de plus.',
        modifiers: [{ stat: 'trapSlotsAdd', add: 4 }],
      },
      legendary: {
        description: 'Tu peux poser six pièges de plus.',
        modifiers: [{ stat: 'trapSlotsAdd', add: 6 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'boule-a-facettes',
    name: 'Boule à facettes',
    description: 'Tu attires les vibes, tires plus et frappes plus fort.',
    family: 'relic',
    modifiers: [
      { stat: 'pickupRadiusMul', mul: 1.5 },
      { stat: 'projectileCountAdd', add: 1 },
      { stat: 'damageMul', mul: 1.2 },
    ],
    maxStacks: 1,
  },
  {
    id: 'machine-a-fumee',
    name: 'Machine à fumée',
    description: 'Tu deviens plus solide et tu glisses plus vite.',
    family: 'relic',
    modifiers: [
      { stat: 'maxHpAdd', add: 40 },
      { stat: 'speedMul', mul: 1.15 },
    ],
    maxStacks: 1,
  },
  {
    id: 'cable-d-or',
    name: "Câble d'or",
    description: 'Tes pièges frappent fort et loin, et tes loots abondent.',
    family: 'relic',
    modifiers: [
      { stat: 'trapDamageMul', mul: 1.3 },
      { stat: 'trapRadiusMul', mul: 1.2 },
      { stat: 'lootIntervalMul', mul: 0.8 },
    ],
    maxStacks: 1,
  },
  {
    id: 'console-de-mixage',
    name: 'Console de mixage',
    description: 'Tu tires plus souvent et ta spéciale revient plus vite.',
    family: 'relic',
    modifiers: [
      { stat: 'attackCooldownMul', mul: 0.8 },
      { stat: 'skillCooldownMul', mul: 0.7 },
      { stat: 'skillPowerMul', mul: 1.3 },
    ],
    maxStacks: 1,
  },
  {
    id: 'projecteur-de-poursuite',
    name: 'Projecteur de poursuite',
    description: 'Tes tirs vont plus vite, traversent plus et frappent fort.',
    family: 'relic',
    modifiers: [
      { stat: 'pierceAdd', add: 2 },
      { stat: 'projectileSpeedMul', mul: 1.3 },
      { stat: 'damageMul', mul: 1.25 },
    ],
    maxStacks: 1,
  },
  {
    id: 'sono-de-reference',
    name: 'Sono de référence',
    description: 'Tes pièges frappent plus fort et couvrent plus de piste.',
    family: 'relic',
    modifiers: [
      { stat: 'trapDamageMul', mul: 1.4 },
      { stat: 'trapRadiusMul', mul: 1.3 },
    ],
    maxStacks: 1,
  },
  ...KIFFEUR_UPGRADES,
  ...FULL_UPGRADES,
];

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
    description: 'Tu tires un projectile de plus.',
    family: 'class',
    classId: 'mage',
    modifiers: [{ stat: 'projectileCountAdd', add: 1 }],
    rarities: {
      rare: {
        description: 'Tu tires deux projectiles de plus.',
        modifiers: [{ stat: 'projectileCountAdd', add: 2 }],
      },
      legendary: {
        description: 'Tu tires trois projectiles de plus.',
        modifiers: [{ stat: 'projectileCountAdd', add: 3 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'lumiere-traversante',
    name: 'Lumière traversante',
    description: 'Tes tirs traversent une bad vibe de plus.',
    family: 'class',
    classId: 'mage',
    modifiers: [{ stat: 'pierceAdd', add: 1 }],
    rarities: {
      rare: {
        description: 'Tes tirs traversent deux bad vibes de plus.',
        modifiers: [{ stat: 'pierceAdd', add: 2 }],
      },
      legendary: {
        description: 'Tes tirs traversent trois bad vibes de plus.',
        modifiers: [{ stat: 'pierceAdd', add: 3 }],
      },
    },
    maxStacks: 3,
  },
  {
    id: 'nova-xxl',
    name: 'Nova XXL',
    description: 'Ta nova frappe plus fort.',
    family: 'class',
    classId: 'mage',
    modifiers: [{ stat: 'skillPowerMul', mul: 1.25 }],
    rarities: {
      rare: {
        description: 'Ta nova frappe bien plus fort.',
        modifiers: [{ stat: 'skillPowerMul', mul: 1.5 }],
      },
      legendary: {
        description: 'Ta nova frappe deux fois plus fort.',
        modifiers: [{ stat: 'skillPowerMul', mul: 1.75 }],
      },
    },
    maxStacks: 3,
  },
  {
    id: 'boucle-vj',
    name: 'Boucle VJ',
    description: 'Ta nova revient plus vite.',
    family: 'class',
    classId: 'mage',
    modifiers: [{ stat: 'skillCooldownMul', mul: 0.8 }],
    rarities: {
      rare: {
        description: 'Ta nova revient bien plus vite.',
        modifiers: [{ stat: 'skillCooldownMul', mul: 0.6 }],
      },
      legendary: {
        description: 'Ta nova revient presque en continu.',
        modifiers: [{ stat: 'skillCooldownMul', mul: 0.4 }],
      },
    },
    maxStacks: 3,
  },
  {
    id: 'jambes-de-danseur',
    name: 'Jambes de danseur',
    description: 'Tu te déplaces plus vite.',
    family: 'generic',
    modifiers: [{ stat: 'speedMul', mul: 1.1 }],
    rarities: {
      rare: {
        description: 'Tu te déplaces nettement plus vite.',
        modifiers: [{ stat: 'speedMul', mul: 1.2 }],
      },
      legendary: {
        description: 'Tu te déplaces bien plus vite.',
        modifiers: [{ stat: 'speedMul', mul: 1.3 }],
      },
    },
    maxStacks: 3,
  },
  {
    id: 'deuxieme-souffle',
    name: 'Deuxième souffle',
    description: 'Tu gagnes 20 points de vie maximum.',
    family: 'generic',
    modifiers: [{ stat: 'maxHpAdd', add: 20 }],
    rarities: {
      rare: {
        description: 'Tu gagnes 40 points de vie maximum.',
        modifiers: [{ stat: 'maxHpAdd', add: 40 }],
      },
      legendary: {
        description: 'Tu gagnes 60 points de vie maximum.',
        modifiers: [{ stat: 'maxHpAdd', add: 60 }],
      },
    },
    maxStacks: 4,
  },
  {
    id: 'bonnes-ondes',
    name: 'Bonnes ondes',
    description: 'Tu attires les vibes de plus loin.',
    family: 'generic',
    modifiers: [{ stat: 'pickupRadiusMul', mul: 1.3 }],
    rarities: {
      rare: {
        description: 'Tu attires les vibes de bien plus loin.',
        modifiers: [{ stat: 'pickupRadiusMul', mul: 1.6 }],
      },
      legendary: {
        description: 'Tu attires les vibes de très loin.',
        modifiers: [{ stat: 'pickupRadiusMul', mul: 1.9 }],
      },
    },
    maxStacks: 3,
  },
  {
    id: 'volume-a-fond',
    name: 'Volume à fond',
    description: 'Tes tirs font plus de dégâts.',
    family: 'generic',
    modifiers: [{ stat: 'damageMul', mul: 1.15 }],
    rarities: {
      rare: {
        description: 'Tes tirs font nettement plus de dégâts.',
        modifiers: [{ stat: 'damageMul', mul: 1.3 }],
      },
      legendary: {
        description: 'Tes tirs font bien plus de dégâts.',
        modifiers: [{ stat: 'damageMul', mul: 1.45 }],
      },
    },
    maxStacks: 5,
  },
  {
    id: 'double-tempo',
    name: 'Double tempo',
    description: 'Tu tires plus souvent.',
    family: 'generic',
    modifiers: [{ stat: 'attackCooldownMul', mul: 0.88 }],
    rarities: {
      rare: {
        description: 'Tu tires nettement plus souvent.',
        modifiers: [{ stat: 'attackCooldownMul', mul: 0.76 }],
      },
      legendary: {
        description: 'Tu tires bien plus souvent.',
        modifiers: [{ stat: 'attackCooldownMul', mul: 0.64 }],
      },
    },
    maxStacks: 4,
  },
  {
    id: 'sub-renforce',
    name: 'Sub renforcé',
    description: 'Tes pièges font plus de dégâts.',
    family: 'defense',
    modifiers: [{ stat: 'trapDamageMul', mul: 1.2 }],
    rarities: {
      rare: {
        description: 'Tes pièges font bien plus de dégâts.',
        modifiers: [{ stat: 'trapDamageMul', mul: 1.4 }],
      },
      legendary: {
        description: 'Tes pièges font deux fois plus de dégâts.',
        modifiers: [{ stat: 'trapDamageMul', mul: 1.6 }],
      },
    },
    maxStacks: 4,
  },
  {
    id: 'rallonge',
    name: 'Rallonge',
    description: 'Tu peux poser un piège de plus.',
    family: 'defense',
    modifiers: [{ stat: 'trapSlotsAdd', add: 1 }],
    rarities: {
      rare: {
        description: 'Tu peux poser deux pièges de plus.',
        modifiers: [{ stat: 'trapSlotsAdd', add: 2 }],
      },
      legendary: {
        description: 'Tu peux poser trois pièges de plus.',
        modifiers: [{ stat: 'trapSlotsAdd', add: 3 }],
      },
    },
    maxStacks: 3,
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
    description: 'Tes pièges frappent plus fort et plus loin.',
    family: 'relic',
    modifiers: [
      { stat: 'trapDamageMul', mul: 1.3 },
      { stat: 'trapRadiusMul', mul: 1.2 },
    ],
    maxStacks: 1,
  },
  {
    id: 'console-de-mixage',
    name: 'Console de mixage',
    description: 'Tu tires plus souvent et ta nova revient plus vite.',
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
];

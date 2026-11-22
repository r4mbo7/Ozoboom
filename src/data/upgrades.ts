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
    name: 'Double Beam',
    description: 'You fire two more projectiles.',
    family: 'class',
    classId: 'mage',
    modifiers: [{ stat: 'projectileCountAdd', add: 2 }],
    rarities: {
      rare: {
        description: 'You fire four more projectiles.',
        modifiers: [{ stat: 'projectileCountAdd', add: 4 }],
      },
      legendary: {
        description: 'You fire six more projectiles.',
        modifiers: [{ stat: 'projectileCountAdd', add: 6 }],
      },
    },
    maxStacks: 1,
  },
  {
    id: 'lumiere-traversante',
    name: 'Piercing Light',
    description: 'Your shots go through two more bad vibes.',
    family: 'class',
    classId: 'mage',
    modifiers: [{ stat: 'pierceAdd', add: 2 }],
    rarities: {
      rare: {
        description: 'Your shots go through four more bad vibes.',
        modifiers: [{ stat: 'pierceAdd', add: 4 }],
      },
      legendary: {
        description: 'Your shots go through six more bad vibes.',
        modifiers: [{ stat: 'pierceAdd', add: 6 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'nova-xxl',
    name: 'Special XXL',
    description: 'Your special hits harder.',
    family: 'class',
    classId: 'mage',
    modifiers: [{ stat: 'skillPowerMul', mul: 1.55 }],
    rarities: {
      rare: {
        description: 'Your special hits twice as hard.',
        modifiers: [{ stat: 'skillPowerMul', mul: 2.25 }],
      },
      legendary: {
        description: 'Your special hits three times as hard.',
        modifiers: [{ stat: 'skillPowerMul', mul: 3 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'boucle-vj',
    name: 'VJ Loop',
    description: 'Your special comes back faster.',
    family: 'class',
    classId: 'mage',
    modifiers: [{ stat: 'skillCooldownMul', mul: 0.64 }],
    rarities: {
      rare: {
        description: 'Your special comes back much faster.',
        modifiers: [{ stat: 'skillCooldownMul', mul: 0.36 }],
      },
      legendary: {
        description: 'Your special comes back almost non-stop.',
        modifiers: [{ stat: 'skillCooldownMul', mul: 0.16 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'jambes-de-danseur',
    name: 'Dancer’s Legs',
    description: 'You move faster.',
    family: 'generic',
    modifiers: [{ stat: 'speedMul', mul: 1.2 }],
    rarities: {
      rare: {
        description: 'You move a lot faster.',
        modifiers: [{ stat: 'speedMul', mul: 1.45 }],
      },
      legendary: {
        description: 'You move much faster.',
        modifiers: [{ stat: 'speedMul', mul: 1.7 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'deuxieme-souffle',
    name: 'Second Wind',
    description: 'You gain 40 max health.',
    family: 'generic',
    modifiers: [{ stat: 'maxHpAdd', add: 40 }],
    rarities: {
      rare: {
        description: 'You gain 80 max health.',
        modifiers: [{ stat: 'maxHpAdd', add: 80 }],
      },
      legendary: {
        description: 'You gain 120 max health.',
        modifiers: [{ stat: 'maxHpAdd', add: 120 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'bonnes-ondes',
    name: 'Good Vibrations',
    description: 'You draw in vibes from farther away.',
    family: 'generic',
    modifiers: [{ stat: 'pickupRadiusMul', mul: 1.7 }],
    rarities: {
      rare: {
        description: 'You draw in vibes from much farther away.',
        modifiers: [{ stat: 'pickupRadiusMul', mul: 2.5 }],
      },
      legendary: {
        description: 'You draw in vibes from very far away.',
        modifiers: [{ stat: 'pickupRadiusMul', mul: 3.6 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'baskets-legeres',
    name: 'Light Sneakers',
    description: 'Your dash comes back faster.',
    family: 'generic',
    modifiers: [{ stat: 'dashRechargeMul', mul: 0.75 }],
    rarities: {
      rare: {
        description: 'Your dash comes back a lot faster.',
        modifiers: [{ stat: 'dashRechargeMul', mul: 0.5 }],
      },
      legendary: {
        description: 'Your dash comes back much faster.',
        modifiers: [{ stat: 'dashRechargeMul', mul: 0.375 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'pas-chasse',
    name: 'Chassé Step',
    description: 'You can chain one more dash.',
    family: 'generic',
    modifiers: [{ stat: 'dashChargesAdd', add: 1 }],
    rarities: {
      rare: {
        description: 'You can chain two more dashes.',
        modifiers: [{ stat: 'dashChargesAdd', add: 2 }],
      },
      legendary: {
        description: 'You can chain three more dashes.',
        modifiers: [{ stat: 'dashChargesAdd', add: 3 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'volume-a-fond',
    name: 'Volume Maxed',
    description: 'Your shots deal more damage.',
    family: 'generic',
    modifiers: [{ stat: 'damageMul', mul: 1.3 }],
    rarities: {
      rare: {
        description: 'Your shots deal a lot more damage.',
        modifiers: [{ stat: 'damageMul', mul: 1.7 }],
      },
      legendary: {
        description: 'Your shots deal twice the damage.',
        modifiers: [{ stat: 'damageMul', mul: 2.1 }],
      },
    },
    maxStacks: 3,
  },
  {
    id: 'double-tempo',
    name: 'Double Time',
    description: 'You fire more often.',
    family: 'generic',
    modifiers: [{ stat: 'attackCooldownMul', mul: 0.77 }],
    rarities: {
      rare: {
        description: 'You fire a lot more often.',
        modifiers: [{ stat: 'attackCooldownMul', mul: 0.58 }],
      },
      legendary: {
        description: 'You fire much more often.',
        modifiers: [{ stat: 'attackCooldownMul', mul: 0.41 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'sub-renforce',
    name: 'Boosted Sub',
    description: 'Your traps deal more damage.',
    family: 'defense',
    modifiers: [{ stat: 'trapDamageMul', mul: 1.45 }],
    rarities: {
      rare: {
        description: 'Your traps deal twice the damage.',
        modifiers: [{ stat: 'trapDamageMul', mul: 2 }],
      },
      legendary: {
        description: 'Your traps deal two and a half times the damage.',
        modifiers: [{ stat: 'trapDamageMul', mul: 2.5 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'talkie-walkie',
    name: 'Walkie-Talkie',
    description: 'Traps show up more often.',
    family: 'defense',
    modifiers: [{ stat: 'carrierIntervalMul', mul: 0.72 }],
    rarities: {
      rare: {
        description: 'Traps show up twice as often.',
        modifiers: [{ stat: 'carrierIntervalMul', mul: 0.5 }],
      },
      legendary: {
        description: 'Traps show up three times as often.',
        modifiers: [{ stat: 'carrierIntervalMul', mul: 0.3 }],
      },
    },
    maxStacks: 2,
  },
  {
    id: 'banane',
    name: 'Bum Bag',
    description: 'You take traps from farther away.',
    family: 'defense',
    modifiers: [{ stat: 'liftReachMul', mul: 2.5 }],
    rarities: {
      rare: {
        description: 'You take traps from much farther away.',
        modifiers: [{ stat: 'liftReachMul', mul: 4 }],
      },
      legendary: {
        description: 'You take traps from very far away.',
        modifiers: [{ stat: 'liftReachMul', mul: 6 }],
      },
    },
    maxStacks: 1,
  },
  {
    id: 'rallonge',
    name: 'Extension Cord',
    description: 'You recharge traps as you pass by.',
    family: 'defense',
    modifiers: [{ stat: 'trapRechargeBarsAdd', add: 2 }],
    rarities: {
      rare: {
        description: 'You recharge traps well as you pass by.',
        modifiers: [{ stat: 'trapRechargeBarsAdd', add: 3 }],
      },
      legendary: {
        description: 'You recharge traps a lot as you pass by.',
        modifiers: [{ stat: 'trapRechargeBarsAdd', add: 4 }],
      },
    },
    maxStacks: 1,
  },
  {
    id: 'colliers-de-serrage',
    name: 'Zip Ties',
    description: 'Your traps wear out more slowly.',
    family: 'defense',
    modifiers: [{ stat: 'trapWearMul', mul: 0.9 }],
    rarities: {
      rare: {
        description: 'Your traps wear out a lot more slowly.',
        modifiers: [{ stat: 'trapWearMul', mul: 0.8 }],
      },
      legendary: {
        description: 'Your traps wear out much more slowly.',
        modifiers: [{ stat: 'trapWearMul', mul: 0.7 }],
      },
    },
    maxStacks: 1,
  },
  // A trap to lay, for a player with room above the head: never recorded, so never used up.
  {
    id: 'piege-neuf',
    name: 'New Trap',
    description: 'A brand-new trap, ready to drop.',
    family: 'defense',
    modifiers: [],
    maxStacks: 1,
    gives: { trap: 'shown' },
  },
  {
    id: 'piege-surprise',
    name: 'Surprise Trap',
    description: 'A random trap, ready to drop.',
    family: 'defense',
    modifiers: [],
    maxStacks: 1,
    gives: { trap: 'surprise' },
  },
  {
    id: 'boule-a-facettes',
    name: 'Disco Ball',
    description: 'You draw in vibes, fire more and hit harder.',
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
    name: 'Smoke Machine',
    description: 'You get sturdier and glide faster.',
    family: 'relic',
    modifiers: [
      { stat: 'maxHpAdd', add: 40 },
      { stat: 'speedMul', mul: 1.15 },
    ],
    maxStacks: 1,
  },
  {
    id: 'cable-d-or',
    name: 'Golden Cable',
    description: 'Your traps hit hard and far, and their carriers pour in.',
    family: 'relic',
    modifiers: [
      { stat: 'trapDamageMul', mul: 1.3 },
      { stat: 'trapRadiusMul', mul: 1.2 },
      { stat: 'carrierIntervalMul', mul: 0.8 },
    ],
    maxStacks: 1,
  },
  {
    id: 'console-de-mixage',
    name: 'Mixing Desk',
    description: 'You fire more often and your special comes back faster.',
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
    name: 'Follow Spot',
    description: 'Your shots fly faster, go through more and hit hard.',
    family: 'relic',
    modifiers: [
      { stat: 'pierceAdd', add: 2 },
      { stat: 'projectileSpeedMul', mul: 1.3 },
      { stat: 'damageMul', mul: 1.25 },
    ],
    maxStacks: 1,
  },
  {
    id: 'mur-de-son',
    name: 'Wall of Sound',
    description: 'Your traps hit harder and cover more of the floor.',
    family: 'relic',
    modifiers: [
      { stat: 'trapDamageMul', mul: 1.4 },
      { stat: 'trapRadiusMul', mul: 1.3 },
    ],
    maxStacks: 1,
  },
  {
    id: 'tamatebako',
    name: 'Tamatebako',
    description: 'Every future offer shows one more choice.',
    family: 'relic',
    modifiers: [{ stat: 'offerCardsAdd', add: 1 }],
    maxStacks: 1,
  },
  ...KIFFEUR_UPGRADES,
  ...FULL_UPGRADES,
];

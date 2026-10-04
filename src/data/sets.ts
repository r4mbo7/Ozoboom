import { DEFAULT_BPM } from '../shared/tempo';
import type { SetDefinition } from './types';

export const SETS: readonly SetDefinition[] = [
  {
    id: 'soiree-v0',
    name: "La soirée d'ouverture",
    bpm: DEFAULT_BPM,
    arena: { width: 1600, height: 1000 },
    core: { radius: 56, maxHp: 500, wattsPerBar: 5 },
    startingWatts: 15,
    maxTraps: 6,
    levelCurve: { baseVibes: 5, vibesPerLevel: 4 },
    tiers: [
      {
        buildupPhrases: 4,
        breakBars: 4,
        bossId: 'couvre-feu',
        spawns: [
          { enemyId: 'relou', everyBars: 2, count: 2, fromPhrase: 0 },
          { enemyId: 'relou', everyBars: 2, count: 1, fromPhrase: 1 },
          { enemyId: 'foule-au-bar', everyBars: 4, count: 4, fromPhrase: 1 },
          { enemyId: 'pluie', everyBars: 8, count: 1, fromPhrase: 2 },
          { enemyId: 'foule-au-bar', everyBars: 4, count: 2, fromPhrase: 2 },
          { enemyId: 'vigile', everyBars: 8, count: 1, fromPhrase: 3 },
          { enemyId: 'relou', everyBars: 1, count: 1, fromPhrase: 3 },
        ],
      },
      {
        buildupPhrases: 4,
        breakBars: 4,
        bossId: 'batterie-a-plat',
        spawns: [
          { enemyId: 'relou', everyBars: 1, count: 2, fromPhrase: 0 },
          { enemyId: 'foule-au-bar', everyBars: 2, count: 4, fromPhrase: 0 },
          { enemyId: 'pluie', everyBars: 4, count: 1, fromPhrase: 1 },
          { enemyId: 'vigile', everyBars: 8, count: 1, fromPhrase: 1 },
          { enemyId: 'foule-au-bar', everyBars: 2, count: 4, fromPhrase: 2 },
          { enemyId: 'relou', everyBars: 1, count: 2, fromPhrase: 3 },
          { enemyId: 'vigile', everyBars: 4, count: 1, fromPhrase: 3 },
        ],
      },
    ],
  },
];

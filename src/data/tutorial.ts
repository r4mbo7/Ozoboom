import { MAIN_STAGE } from './main-stage';
import type { SetDefinition } from './types';

// The Main stage, short and gentle: one tier, a sound system that holds, a first level that comes fast.
export const TUTORIAL: SetDefinition = {
  ...MAIN_STAGE,
  id: 'didacticiel',
  name: 'Didacticiel',
  core: { radius: 56, maxHp: 2000 },
  levelCurve: { baseVibes: 6, vibesPerLevel: 16 },
  tiers: [
    {
      buildupPhrases: 4,
      breakBars: 4,
      boss: { maxHp: 600, damage: 15, vibesDrop: 40 },
      spawns: [
        { enemyId: 'desagreable', everyBars: 2, count: 1, fromPhrase: 0 },
        { enemyId: 'random', everyBars: 4, count: 2, fromPhrase: 1 },
        { enemyId: 'meprisant', everyBars: 8, count: 1, fromPhrase: 2 },
      ],
      dropSpawns: [{ enemyId: 'desagreable', everyBars: 2, count: 1, fromPhrase: 0 }],
    },
  ],
};

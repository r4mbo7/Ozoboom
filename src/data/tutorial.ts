import { MAIN_STAGE } from './main-stage';
import type { SetDefinition } from './types';

// The Main stage without its doubled vibes, a bonus that would muddle the gestures the banner asks.
function withoutTwinVibes(set: SetDefinition): SetDefinition {
  const rules = { ...set };
  delete rules.twinVibes;
  return rules;
}

// The Main stage, short and gentle: one tier, a sound system that holds, a first level that comes fast.
export const TUTORIAL: SetDefinition = {
  ...withoutTwinVibes(MAIN_STAGE),
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

import { BYSTANDERS } from './bystanders';
import { CLASSES } from './classes';
import { ENEMIES } from './enemies';
import { SETS } from './sets';
import { TRAPS } from './traps';
import type { GameContent } from './types';
import { UPGRADES } from './upgrades';

export const CONTENT: GameContent = {
  classes: CLASSES,
  enemies: ENEMIES,
  traps: TRAPS,
  upgrades: UPGRADES,
  sets: SETS,
  bystanders: BYSTANDERS,
};

import { BYSTANDERS } from './bystanders';
import { CLASSES } from './classes';
import { ENEMIES } from './enemies';
import { FUSIONS } from './fusions';
import { SETS } from './sets';
import { TRAPS } from './traps';
import type { GameContent } from './types';
import { UPGRADES } from './upgrades';
import { WEAPONS } from './weapons';

export const CONTENT: GameContent = {
  classes: CLASSES,
  enemies: ENEMIES,
  traps: TRAPS,
  upgrades: UPGRADES,
  sets: SETS,
  bystanders: BYSTANDERS,
  weapons: WEAPONS,
  fusions: FUSIONS,
};

import { BAD_VIBES_TAB } from './bad-vibes';
import { BOSSES_TAB } from './bosses';
import { CHARACTERS_TAB } from './characters';
import { PROPS_TAB } from './props';
import { MAP_TAB } from './stages';
import { TRAPS_TAB } from './traps';
import type { ProgrammeTab } from './types';
import { UPGRADES_TAB } from './upgrades';

// In the strip's order: Characters, Upgrades, Props, Traps, Bad vibes, Bosses, Map.
export const PROGRAMME_TABS: readonly ProgrammeTab[] = [
  CHARACTERS_TAB,
  UPGRADES_TAB,
  PROPS_TAB,
  TRAPS_TAB,
  BAD_VIBES_TAB,
  BOSSES_TAB,
  MAP_TAB,
];

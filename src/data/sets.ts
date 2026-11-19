import { FULL_SETS } from './full';
import { MAIN_STAGE } from './main-stage';
import type { SetDefinition } from './types';

export { MAIN_STAGE };

// A speaker of radius 40 draws its tarp's pegs out to 74, its LED column out to 87.
export const SPEAKER_REACH = 2.2;

// No stage bonus falls due in a phrase that starts within this long of the game's start.
export const STAGE_BONUS_GRACE_SECONDS = 60;

export const SETS: readonly SetDefinition[] = [MAIN_STAGE, ...FULL_SETS];

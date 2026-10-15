import { FULL_SETS } from './full';
import { MAIN_STAGE } from './main-stage';
import type { SetDefinition } from './types';

export { MAIN_STAGE };

// How far a speaker's drawing reaches from its centre, as a share of its radius: up to 74 for a radius of 40 for the
// tarp's pegs, 87 for its LED column and standby LED.
export const SPEAKER_REACH = 2.2;

export const SETS: readonly SetDefinition[] = [MAIN_STAGE, ...FULL_SETS];

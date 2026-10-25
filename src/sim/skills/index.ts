import type { SkillEffect } from '../../data/types';
import { FULL_SKILLS } from '../full';
import { dash } from './dash';
import { healPulse } from './heal-pulse';
import { nova } from './nova';
import type { SkillModule, SkillModules } from './types';

export const SKILLS: SkillModules = { nova, dash, healPulse, ...FULL_SKILLS };

export function skillModule(effect: SkillEffect): SkillModule<SkillEffect> {
  return SKILLS[effect.kind];
}

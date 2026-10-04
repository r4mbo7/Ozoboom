import type { SpecialEffect } from '../../data/types';
import type { EnemyState } from '../state';
import type { StepContext } from '../systems/types';

export type SpecialModule = (ctx: StepContext, enemy: EnemyState, effect: SpecialEffect) => void;

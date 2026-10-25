import type { SpecialEffect } from '../../data/types';
import type { Circle } from '../spatial-hash';
import type { EnemyState } from '../state';
import type { StepContext } from '../systems/types';

export type SpecialModule = (ctx: StepContext, enemy: EnemyState, effect: SpecialEffect) => void;

export interface SteeringOverride {
  readonly target: Circle;
  readonly speedMul?: number;
}

// Returning undefined falls back to the default targeting.
export type SteeringTarget = (
  ctx: StepContext,
  enemy: EnemyState,
  effect: SpecialEffect,
) => SteeringOverride | undefined;

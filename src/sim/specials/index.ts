import type { SpecialEffect } from '../../data/types';
import { babble } from './babble';
import { cling, clingSteering } from './cling';
import { dazzle } from './dazzle';
import { frontGuard } from './front-guard';
import { revive } from './revive';
import { shove } from './shove';
import { sigh } from './sigh';
import { steal, stealSteering } from './steal';
import { suppress } from './suppress';
import type { SpecialModule, SteeringTarget } from './types';
import { yawn } from './yawn';

export const SPECIALS: Record<SpecialEffect['kind'], SpecialModule> = {
  shove,
  sigh,
  cling,
  suppress,
  steal,
  yawn,
  revive,
  dazzle,
  babble,
  frontGuard,
};

// Extension point for enemy-steering: a special supplies its own steering target and speed
// instead of the system special-casing a sort by kind.
export const STEERING_TARGETS: Partial<Record<SpecialEffect['kind'], SteeringTarget>> = {
  steal: stealSteering,
  cling: clingSteering,
};

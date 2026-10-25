import type { SpecialEffect } from '../../data/types';
import { FULL_SPECIALS } from '../full';
import { babble } from './babble';
import { cling, clingSteering } from './cling';
import { dazzle } from './dazzle';
import { frontGuard } from './front-guard';
import { gust } from './gust';
import { moshRing } from './mosh-ring';
import { revive } from './revive';
import { shove } from './shove';
import { bottle } from './bottle';
import { steal, stealSteering } from './steal';
import { suppress } from './suppress';
import type { SpecialModule, SteeringTarget } from './types';
import { yawn } from './yawn';

export const SPECIALS: Record<SpecialEffect['kind'], SpecialModule> = {
  shove,
  bottle,
  cling,
  suppress,
  steal,
  yawn,
  revive,
  dazzle,
  babble,
  frontGuard,
  gust,
  moshRing,
  ...FULL_SPECIALS,
};

// So that enemy-steering never special-cases a sort by kind.
export const STEERING_TARGETS: Partial<Record<SpecialEffect['kind'], SteeringTarget>> = {
  steal: stealSteering,
  cling: clingSteering,
};

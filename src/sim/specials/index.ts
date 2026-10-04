import type { SpecialEffect } from '../../data/types';
import { babble } from './babble';
import { cling } from './cling';
import { dazzle } from './dazzle';
import { revive } from './revive';
import { shove } from './shove';
import { sigh } from './sigh';
import { steal } from './steal';
import { suppress } from './suppress';
import type { SpecialModule } from './types';
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
};

import type { DashDefinition } from './types';

export const DASH: DashDefinition = {
  distance: 60,
  ticks: 4,
  rechargeBeats: 8,
  minRechargeBeats: 2,
  charges: 1,
  maxCharges: 4,
  onBeatTicks: 2,
  onBeatDistanceMul: 4 / 3,
};

import { TICK_RATE_HZ } from '../shared/tempo';
import type { SimState } from './state';
import { volumeMul } from './volume';

const PER_PHRASE = 1000;
const PER_SECOND = 10;
const PER_KILL = 5;
const PER_CORE_PERCENT = 2;

// Phrases held, then survival time, then kills and the core's remaining life, raised by the Volume.
export function scoreOf(state: SimState): number {
  const { core, stats } = state;
  const seconds = Math.floor(state.tick / TICK_RATE_HZ);
  const corePercent = Math.floor((Math.max(0, core.hp) * 100) / core.maxHp);
  const base =
    stats.phrasesHeld * PER_PHRASE +
    seconds * PER_SECOND +
    stats.kills * PER_KILL +
    corePercent * PER_CORE_PERCENT;
  return Math.floor(base * volumeMul(state));
}

import { TICK_RATE_HZ } from '../shared/tempo';
import type { SimState } from './state';
import { volumeMul } from './volume';

const PER_PHRASE = 1000;
const PER_SECOND = 10;
const PER_KILL = 5;
const PER_CORE_PERCENT = 2;
const PER_STAGE_HELD = 5000;
const PER_CALLED_BOSS = 500;

export function scoreOf(state: SimState): number {
  const { core, stats } = state;
  const stagesHeld = (state.festival?.scenes ?? []).filter(
    (scene) => scene.toTick !== undefined,
  ).length;
  const seconds = Math.floor(state.tick / TICK_RATE_HZ);
  const corePercent = Math.floor((Math.max(0, core.hp) * 100) / core.maxHp);
  const base =
    stats.phrasesHeld * PER_PHRASE +
    seconds * PER_SECOND +
    stats.kills * PER_KILL +
    corePercent * PER_CORE_PERCENT +
    stagesHeld * PER_STAGE_HELD +
    (stats.calledDown ?? 0) * PER_CALLED_BOSS;
  return Math.floor(base * volumeMul(state));
}

import { MAIN_TEMPO, type Tempo } from '../shared/tempo';
import { segmentMusicTicks } from '../sim/lineup';
import type { SimState } from '../sim/state';

export type DropClock = Pick<SimState, 'status'> & {
  set: Pick<SimState['set'], 'tier' | 'segment' | 'segmentStartTick' | 'segmentReplayTicks'>;
};

const FIRST_DROP_PEAK = 0.75;
const ECHO_ALPHA = { night: 0.9, day: 0.45 };
// The same at every intensity: a weaker drop leaves fainter echoes, not shorter trails.
export const KEEP_PER_TICK = 0.88;
export const MAX_STEP_TICKS = 4;

// Falls after its phrase even if a boss keeps the drop going.
export function dropFilterIntensity(
  state: DropClock,
  now: number,
  { ticksPerBar, ticksPerPhrase }: Tempo = MAIN_TEMPO,
): number {
  const riseTicks = ticksPerBar;
  const holdTicks = ticksPerPhrase;
  const fallTicks = 4 * ticksPerBar;
  if (state.status === 'won' || state.set.segment !== 'drop') {
    return 0;
  }
  const elapsed = segmentMusicTicks(state.set, now);
  const peak = state.set.tier === 0 ? FIRST_DROP_PEAK : 1;
  if (elapsed <= 0) {
    return 0;
  }
  if (elapsed < riseTicks) {
    return (peak * elapsed) / riseTicks;
  }
  const falling = elapsed - riseTicks - holdTicks;
  if (falling <= 0) {
    return peak;
  }
  return falling >= fallTicks ? 0 : peak * (1 - falling / fallTicks);
}

// So that the first drop's echoes are fainter and none pops in or out.
export function echoAlpha(intensity: number, night: boolean): number {
  return (night ? ECHO_ALPHA.night : ECHO_ALPHA.day) * intensity;
}

import { STAGE_BONUS_GRACE_SECONDS } from '../../data/sets';
import type { SetDefinition } from '../../data/types';
import { nextFloat, nextInt, nextU32, seedRng, type RngState } from '../../shared/prng';
import { TICK_RATE_HZ, type Tempo } from '../../shared/tempo';
import { segmentMusicTicks, setTempo } from '../lineup';
import type { EnemyState, SimState } from '../state';

export interface DrawnPhrase {
  tier: number;
  phrase: number;
}

// A stage bonus's draw of the phrase it falls due in, from the seed and the stage's start.
type PhraseDraw = (seed: number, stageStartTick: number, set: SetDefinition) => DrawnPhrase | null;

// The seed goes through the generator before the stage's start joins it: the twin vibes' draw, from seed + start,
// stays as it was, and two bonuses of different tags never share one.
export function saltedPhrase(
  tag: number,
  chance: number,
  seed: number,
  stageStartTick: number,
  set: SetDefinition,
): DrawnPhrase | null {
  const salt = nextU32(seedRng((seed ^ tag) >>> 0));
  const rng = seedRng((salt ^ stageStartTick) >>> 0);
  return nextFloat(rng) < chance ? drawBuildupPhrase(rng, set, stageStartTick) : null;
}

// The build-up phrase a stage bonus falls due in: never the first of a tier, nor one that may start
// within the game's first minute. A tier's phrases start at the earliest after the build-ups before it.
export function drawBuildupPhrase(
  rng: RngState,
  set: SetDefinition,
  stageStartTick: number,
): DrawnPhrase | null {
  const { ticksPerPhrase } = setTempo(set, stageStartTick);
  const graceTicks = STAGE_BONUS_GRACE_SECONDS * TICK_RATE_HZ;
  const choices: DrawnPhrase[] = [];
  let phrasesBefore = 0;
  for (const [tier, { buildupPhrases }] of set.tiers.entries()) {
    for (let phrase = 1; phrase < buildupPhrases; phrase += 1) {
      if (stageStartTick + (phrasesBefore + phrase) * ticksPerPhrase >= graceTicks) {
        choices.push({ tier, phrase });
      }
    }
    phrasesBefore += buildupPhrases;
  }
  return choices.length === 0 ? null : (choices[nextInt(rng, choices.length)] ?? null);
}

// From the drawn phrase to the end of its build-up; outside a build-up, nothing is drawn.
export function inDrawnPhrase(
  state: SimState,
  set: SetDefinition,
  tempo: Tempo,
  draw: PhraseDraw,
): boolean {
  const { set: progress } = state;
  if (progress.segment !== 'buildup') {
    return false;
  }
  const drawn = draw(state.seed, progress.startTick ?? 0, set);
  return (
    drawn !== null &&
    drawn.tier === progress.tier &&
    segmentMusicTicks(progress, state.tick) >= drawn.phrase * tempo.ticksPerPhrase
  );
}

// The first bad vibe spawned this step free to carry a stage bonus: no boss, and nothing carried yet.
export function freeCarrier(state: SimState): EnemyState | undefined {
  for (const event of state.events) {
    if (event.type !== 'enemySpawned') {
      continue;
    }
    const enemy = state.enemies.find(({ id }) => id === event.id);
    if (
      enemy !== undefined &&
      !enemy.isBoss &&
      enemy.carriesTrap === undefined &&
      enemy.carriesBomb !== true &&
      enemy.carriesTwinVibes !== true &&
      enemy.carriesBattery !== true &&
      enemy.carriesPotion !== true
    ) {
      return enemy;
    }
  }
  return undefined;
}

import type { VibeRainRules } from '../../data/types';
import { rotate } from '../../shared/angle';
import { nextFloat } from '../../shared/prng';
import { BEATS_PER_BAR, ticksIntoBar } from '../../shared/tempo';
import { clearOfObstacles } from '../obstacles';
import type { SpeakerState } from '../state';
import type { StepContext } from './types';

// Kept between a landing spot and the core or an obstacle: a vibe is drawn about that wide.
const LANDING_GAP = 8;

export function vibeRain(ctx: StepContext): void {
  const { state, set, tempo } = ctx;
  const rules = set.vibeRain;
  if (rules === undefined) {
    return;
  }
  if (state.events.some((event) => event.type === 'speakerPlugged')) {
    state.vibeRainTicks = rules.bars * tempo.ticksPerBar;
  }
  const ticksLeft = state.vibeRainTicks ?? 0;
  if (ticksLeft <= 0) {
    return;
  }
  state.vibeRainTicks = ticksLeft - 1;

  const sources = (state.speakers ?? []).filter((speaker) => speaker.plugged);
  const perBar = rules.dropsPerBar * sources.length;
  // On the beats, then the eighths, then the sixteenths, as the shower thickens.
  const grid = BEATS_PER_BAR * (perBar <= BEATS_PER_BAR ? 1 : perBar <= 2 * BEATS_PER_BAR ? 2 : 4);
  const inBar = ticksIntoBar(state.tick, tempo);
  for (let step = 0; step < grid; step++) {
    if (Math.floor((step * tempo.ticksPerBar) / grid) !== inBar) {
      continue;
    }
    const end = Math.ceil(((step + 1) * perBar) / grid);
    for (let drop = Math.ceil((step * perBar) / grid); drop < end; drop++) {
      const source = sources[drop % sources.length];
      if (source !== undefined) {
        lob(ctx, rules, source);
      }
    }
  }
}

// The vibe lands on the speaker's half of the disc around the core, denser toward the core.
function lob({ state, set, tempo }: StepContext, rules: VibeRainRules, from: SpeakerState): void {
  const { core } = state;
  const dx = from.x - core.x;
  const dy = from.y - core.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const side = rotate(
    { x: dx / distance, y: dy / distance },
    (nextFloat(state.rng) - 0.5) * Math.PI,
  );
  const nearest = core.radius + LANDING_GAP;
  const reach = nearest + nextFloat(state.rng) * (rules.radius - nearest);
  const { x, y } = clearOfObstacles(
    { x: core.x + side.x * reach, y: core.y + side.y * reach },
    LANDING_GAP,
    set.obstacles ?? [],
  );
  const ticks = rules.flightBeats * tempo.ticksPerBeat;
  state.pickups.push({
    id: state.nextEntityId,
    kind: 'vibes',
    amount: rules.amount,
    x,
    y,
    prevX: x,
    prevY: y,
    ticksLeft: set.pickups.lifetimeTicks,
    flight: { ticksLeft: ticks, ticks, fromX: from.x, fromY: from.y },
  });
  state.nextEntityId += 1;
}

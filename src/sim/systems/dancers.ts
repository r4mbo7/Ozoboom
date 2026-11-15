import type { UnmaskEffect } from '../../data/neon';
import type { EnemyDefinition } from '../../data/types';
import { unitFromAngle } from '../../shared/angle';
import { nextFloat } from '../../shared/prng';
import { clamp } from '../../shared/scalar';
import { isBarTick } from '../../shared/tempo';
import { unmaskOf } from '../dancer';
import { clearOfObstacles } from '../obstacles';
import { ashore } from '../shore';
import type { DancerState, EnemyState, Vec2 } from '../state';
import type { StepContext } from './types';

// A vibe is drawn about that wide.
const LANDING_GAP = 8;
const FLIGHT_BEATS = 1;
const TAU = 2 * Math.PI;
// His burst hops out low, halfway to the rim of his pool of light.
const BURST = { reach: 0.5, arc: 24 };

// Called by `deaths` for each chased bad vibe: one that unmasks leaves its dancer where it fell, in
// place of a recruit.
export function unmaskFallen(
  { state, shore }: StepContext,
  enemy: EnemyState,
  definition: EnemyDefinition,
): boolean {
  if (definition.special?.kind !== 'unmask' || state.dancer !== undefined) {
    return false;
  }
  const { radius, kind } = enemy;
  // Chased in the lake, he dances on its shore, where players walk.
  const { x, y } = ashore(shore, enemy, radius);
  state.dancer = { id: state.nextEntityId, kind, x, y, radius, notches: 0 };
  state.nextEntityId += 1;
  state.events.push({ type: 'dancerUnmasked', id: state.dancer.id, enemyId: enemy.id, x, y });
  return true;
}

// Once a festival stage's sun is up, he dances on and throws no more.
export function dancers(ctx: StepContext): void {
  const { state, content, set, tempo } = ctx;
  const { dancer } = state;
  if (dancer === undefined || set.tiers[state.set.tier] === undefined) {
    return;
  }
  const effect = unmaskOf(content, dancer.kind);
  if (dancer.notches >= effect.notches) {
    maskUp(ctx, dancer, effect);
  } else if (isBarTick(state.tick, tempo)) {
    lob(ctx, dancer, effect);
  }
}

function maskUp(ctx: StepContext, dancer: DancerState, effect: UnmaskEffect): void {
  const { state } = ctx;
  delete state.dancer;
  state.events.push({ type: 'dancerMasked', id: dancer.id, x: dancer.x, y: dancer.y });
  const { pieces, vibes } = effect.burst;
  const first = nextFloat(state.rng) * TAU;
  for (let piece = 0; piece < pieces; piece++) {
    const way = unitFromAngle(first + (piece / pieces) * TAU);
    fling(ctx, dancer, way, effect.trackRadius * BURST.reach, vibes, BURST.arc);
  }
}

// Onto the rim of his pool of light, a seeded way round: someone has to go and get it.
function lob(ctx: StepContext, dancer: DancerState, effect: UnmaskEffect): void {
  const way = unitFromAngle(nextFloat(ctx.state.rng) * TAU);
  fling(ctx, dancer, way, effect.trackRadius, effect.vibesPerBar);
}

function fling(
  { state, set, tempo, obstacles, shore }: StepContext,
  dancer: DancerState,
  way: Vec2,
  reach: number,
  amount: number,
  arc?: number,
): void {
  const { width, height } = state.arena;
  const landing = clearOfObstacles(
    ashore(
      shore,
      {
        x: clamp(dancer.x + way.x * reach, LANDING_GAP, width - LANDING_GAP),
        y: clamp(dancer.y + way.y * reach, LANDING_GAP, height - LANDING_GAP),
      },
      LANDING_GAP,
    ),
    LANDING_GAP,
    obstacles,
  );
  const ticks = FLIGHT_BEATS * tempo.ticksPerBeat;
  state.pickups.push({
    id: state.nextEntityId,
    kind: 'vibes',
    amount,
    x: landing.x,
    y: landing.y,
    prevX: landing.x,
    prevY: landing.y,
    ticksLeft: set.pickups.lifetimeTicks,
    flight: {
      ticksLeft: ticks,
      ticks,
      fromX: dancer.x,
      fromY: dancer.y,
      ...(arc === undefined ? {} : { arc }),
    },
  });
  state.nextEntityId += 1;
}

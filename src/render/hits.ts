import { TICKS_PER_BEAT } from '../shared/tempo';
import type { EntityId, PlayerId, SimEvent, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import { Particles } from './effects';
import type { Frame } from './frame';
import { DamageTally, type EnemyHit, SparkBudget, type Tallied, contactOf } from './hit-marks';
import { HitNumbers } from './hit-numbers';
import { byId } from './util';

const SPARK_TICKS = TICKS_PER_BEAT / 2;
const SHARDS = 5;
const FAN = 2.2;
const FALLBACK_RADIUS = 10;

// What a hit on a bad vibe leaves on screen. `radiusOf` knows a bad vibe until the frame after it left the state.
export function createHits(
  ctx: RenderContext,
  radiusOf: (id: EntityId) => number | undefined,
): Family {
  const { textures: t, layers } = ctx;
  const rings = new Particles(layers.fx, t.ring, 64);
  const shards = new Particles(layers.fx, t.shard, 256);
  const budget = new SparkBudget();
  const tally = new DamageTally();
  const numbers = new HitNumbers(layers.bubbles, t.names, t.halo, 48);
  let seen: SimState | null = null;
  let latest: Frame | null = null;

  function tintOf(by: PlayerId | undefined, state: SimState, frame: Frame): number {
    const hitter = by === undefined ? undefined : byId(state.players, by);
    return frame.palette[(hitter && ctx.classTokens.get(hitter.classId)) ?? 'texte'];
  }

  function showNumber({ id, x, y, by, amount }: Tallied): void {
    if (seen !== null && latest !== null) {
      const reach = radiusOf(id) ?? FALLBACK_RADIUS;
      numbers.spawn(amount, x, y, reach, tintOf(by, seen, latest), seen.tick);
    }
  }

  function spark(hit: EnemyHit, state: SimState, frame: Frame): void {
    const radius = radiusOf(hit.id) ?? FALLBACK_RADIUS;
    const contact = contactOf(hit, radius);
    if (contact === undefined || !budget.tryStart(hit.id, state.tick)) {
      return;
    }
    const tint = tintOf(hit.by, state, frame);
    const { calm } = frame;
    rings.spawn({
      now: state.tick,
      duration: calm ? 2 * SPARK_TICKS : SPARK_TICKS,
      x: contact.x,
      y: contact.y,
      fromRadius: 3,
      toRadius: 8 + radius * 0.6,
      tint,
      peak: calm ? 0.5 : 0.9,
    });
    if (calm) {
      return;
    }
    for (let index = 0; index < SHARDS; index += 1) {
      const angle = contact.angle + (index / (SHARDS - 1) - 0.5) * FAN;
      const reach = (10 + radius * 0.7) * (0.7 + 0.3 * ((index * 3 + hit.id) % 3) * 0.5);
      shards.spawn({
        now: state.tick,
        duration: SPARK_TICKS,
        x: contact.x,
        y: contact.y,
        dx: Math.cos(angle) * reach,
        dy: Math.sin(angle) * reach,
        fromRadius: 6,
        toRadius: 2,
        tint,
        peak: 1,
        rotation: angle + Math.PI / 2,
      });
    }
  }

  function reset(): void {
    rings.clear();
    shards.clear();
    budget.clear();
    tally.clear();
    numbers.clear();
    seen = latest = null;
  }

  return {
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      if (event.type === 'enemyHit') {
        spark(event, state, frame);
        tally.add(event, state.tick);
      }
    },
    update(state: SimState, _alpha: number, frame: Frame): void {
      rings.update(frame.now);
      shards.update(frame.now);
      seen = state;
      latest = frame;
      tally.flush(state.tick, showNumber);
      numbers.update(frame);
    },
    reset,
    destroy: reset,
  };
}

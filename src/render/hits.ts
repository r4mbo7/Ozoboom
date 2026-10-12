import { TICKS_PER_BEAT } from '../shared/tempo';
import type { EntityId, SimEvent, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import { Particles } from './effects';
import type { Frame } from './frame';
import { type EnemyHit, SparkBudget, contactOf } from './hit-marks';
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

  function spark(hit: EnemyHit, state: SimState, frame: Frame): void {
    const radius = radiusOf(hit.id) ?? FALLBACK_RADIUS;
    const contact = contactOf(hit, radius);
    if (contact === undefined || !budget.tryStart(hit.id, state.tick)) {
      return;
    }
    const hitter = hit.by === undefined ? undefined : byId(state.players, hit.by);
    const tint = frame.palette[(hitter && ctx.classTokens.get(hitter.classId)) ?? 'texte'];
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
  }

  return {
    onEvent(event: SimEvent, state: SimState, frame: Frame): void {
      if (event.type === 'enemyHit') {
        spark(event, state, frame);
      }
    },
    update(_state: SimState, _alpha: number, frame: Frame): void {
      rings.update(frame.now);
      shards.update(frame.now);
    },
    reset,
    destroy: reset,
  };
}

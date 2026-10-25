import { TICKS_PER_BEAT } from '../shared/tempo';
import type { PlayerId, SimEvent, SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import { Particles } from './effects';
import type { EnemiesFamily } from './enemies';
import type { Frame } from './frame';
import {
  DamageTally,
  type EnemyHit,
  HOLD_TICKS,
  SparkBudget,
  type Tallied,
  contactOf,
  isHeavy,
} from './hit-marks';
import { HitNumbers } from './hit-numbers';
import { byId } from './util';

const SPARK_TICKS = TICKS_PER_BEAT / 2;
const SHARDS = 5;
const FAN = 2.2;
const FALLBACK_RADIUS = 10;
const WHITE = 0xffffff;

// `enemies` knows a bad vibe until the frame after it left the state.
export function createHits(
  ctx: RenderContext,
  enemies: Pick<EnemiesFamily, 'hold' | 'poseOf'>,
): Family {
  const { textures: t, layers } = ctx;
  const rings = new Particles(layers.fx, t.ring, 64);
  const shards = new Particles(layers.fx, t.shard, 256);
  const flares = new Particles(layers.fx, t.halo, 16);
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
      const reach = enemies.poseOf(id)?.radius ?? FALLBACK_RADIUS;
      numbers.spawn(amount, x, y, reach, tintOf(by, seen, latest), seen.tick);
    }
  }

  function spark(hit: EnemyHit, state: SimState, frame: Frame): void {
    const radius = enemies.poseOf(hit.id)?.radius ?? FALLBACK_RADIUS;
    const contact = contactOf(hit, radius);
    const { calm } = frame;
    if (!calm && isHeavy(hit, byId(state.enemies, hit.id))) {
      enemies.hold(hit.id, state.tick + HOLD_TICKS);
      flares.spawn({
        now: state.tick,
        duration: HOLD_TICKS + 2,
        x: contact?.x ?? hit.x,
        y: contact?.y ?? hit.y,
        fromRadius: radius * 1.8,
        toRadius: radius,
        tint: WHITE,
        peak: 1,
      });
    }
    if (contact === undefined || !budget.tryStart(hit.id, state.tick)) {
      return;
    }
    const tint = tintOf(hit.by, state, frame);
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
    if (calm || enemies.poseOf(hit.id)?.boss === true) {
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
    flares.clear();
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
      flares.update(frame.now);
      seen = state;
      latest = frame;
      tally.flush(state.tick, showNumber);
      numbers.update(frame);
    },
    reset,
    destroy: reset,
  };
}

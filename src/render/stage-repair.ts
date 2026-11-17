import { Graphics } from 'pixi.js';
import { clamp01, smoothstep } from '../shared/scalar';
import { TICKS_PER_BEAT } from '../shared/tempo';
import type { CoreState, SimEvent, SimState } from '../sim/state';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { WHITE, mixColor } from './palette';
import { DRAWN_DOME, createRepairFx } from './stage-repair-fx';
import { LOST_GREY } from './stage-repair-spray';
import { type SegmentSpan, litSegments, litShare, ringAngle, traceSegment } from './vu-meter';

// The bolt's run down the cable: the stage takes the repair when it lands.
export const REPAIR_ARRIVAL = TICKS_PER_BEAT;

// In beats from the landing, as chosen on the review page (.lavish/soin-de-la-scene).
const RUN = 0.2;
const SWEEP = 1;
const POP = 0.35;
const COOL = 3;
const COOLED = COOL + 1;
const WASH_IN = 0.2;
const BREATH = 3;
const BREATH_OUT = 0.6;
const END = 4.2;
const LOST_END = 2;

// The drawings' ring stroke against the game's.
const STROKE = 6 / 3.6;

export interface Repair {
  readonly tick: number;
  readonly amount: number;
  // The segments lit before the repair, and after it.
  readonly from: number;
  readonly to: number;
  // Where the cable lands on the ring, as an angle from the stage's centre.
  readonly toward: number;
}

function beatsSinceLanding(repair: Repair, now: number): number {
  return (now - repair.tick - REPAIR_ARRIVAL) / TICKS_PER_BEAT;
}

function rise(since: number, from: number, length: number): number {
  return smoothstep(clamp01((since - from) / length));
}

// The stage breathes green three beats from the landing.
export function washAt(since: number): number {
  return since < 0 ? 0 : rise(since, 0, WASH_IN) * (1 - rise(since, BREATH, BREATH_OUT));
}

// The gained segments light one after another, from the end of the gain nearest the landing.
export function segmentOn(repair: Repair, index: number): number {
  const count = repair.to - repair.from;
  const fromStart = Math.abs(turn(ringAngle(repair.from) - repair.toward));
  const fromEnd = Math.abs(turn(ringAngle(repair.to) - repair.toward));
  const rank = fromEnd <= fromStart ? repair.to - 1 - index : index - repair.from;
  return RUN + (rank / count) * (SWEEP - RUN);
}

// The landing point's nearest end of the gain, where the green spark runs to.
function sparkTarget(repair: Repair): number {
  const start = turn(ringAngle(repair.from) - repair.toward);
  const end = turn(ringAngle(repair.to) - repair.toward);
  return repair.toward + (Math.abs(end) <= Math.abs(start) ? end : start);
}

function turn(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export interface StageRepair {
  readonly ring: Graphics;
  onEvent(event: SimEvent, state: SimState): void;
  // The segments of a speaker's gain the life ring leaves to the repair, which lights them once the
  // bolt lands; empty once it cools. What a heal adds above them stays the ring's.
  heldFor(segments: number, now: number): SegmentSpan;
  // The stage's colour share: the old life until the bolt lands.
  shareOf(core: Pick<CoreState, 'hp' | 'maxHp'>, now: number): number;
  washOf(now: number): number;
  update(state: SimState, frame: Frame, ringRadius: number, color: number): void;
  reset(): void;
}

export function createStageRepair(ctx: RenderContext): StageRepair {
  const ring = new Graphics();
  const fx = createRepairFx(ctx);
  let repair: Repair | null = null;

  function healing(now: number): Repair | null {
    return repair !== null && repair.amount > 0 && beatsSinceLanding(repair, now) < END
      ? repair
      : null;
  }

  function drawGained(
    healed: Repair,
    since: number,
    segments: number,
    radius: number,
    color: number,
    frame: Frame,
  ): void {
    const { palette, pulse, light, calm } = frame;
    const green = 1 - clamp01(since - COOL);
    for (let index = healed.from; index < Math.min(healed.to, segments); index += 1) {
      const on = segmentOn(healed, index);
      if (since < on) {
        continue;
      }
      const pop = calm ? 0 : 1 - clamp01((since - on) / POP);
      if (green > 0) {
        traceSegment(ring, radius, index).stroke({
          width: (13 + 4 * pulse) * STROKE,
          color: palette.healer,
          alpha: green * (0.45 + 0.4 * pulse + 0.4 * pop) * light.haloAlpha,
          cap: 'butt',
        });
      }
      const width = 6 + STROKE * (green * (1.4 + pulse) + 2 * pop);
      if (!light.additive) {
        traceSegment(ring, radius, index).stroke({
          width: width + 2,
          color: palette.texte,
          cap: 'butt',
        });
      }
      traceSegment(ring, radius, index).stroke({
        width,
        color: mixColor(mixColor(color, palette.healer, green), WHITE, pop * 0.8),
        alpha: 0.75 + 0.25 * pulse,
        cap: 'butt',
      });
    }
  }

  function drawSpark(healed: Repair, since: number, radius: number, frame: Frame): void {
    if (frame.calm || since < 0 || since >= RUN + 0.15 || healed.to === healed.from) {
      return;
    }
    const target = sparkTarget(healed);
    const head = healed.toward + (target - healed.toward) * smoothstep(clamp01(since / RUN));
    const fade = 1 - clamp01((since - RUN) / 0.15);
    ring
      .moveTo(Math.cos(healed.toward) * radius, Math.sin(healed.toward) * radius)
      .arc(0, 0, radius, healed.toward, head, head < healed.toward)
      .stroke({
        width: 2.4 * STROKE,
        color: frame.palette.healer,
        alpha: 0.9 * fade,
        cap: 'round',
      });
  }

  return {
    ring,
    onEvent(event, state): void {
      if (event.type !== 'coreRepaired' || event.speakerId === undefined) {
        return;
      }
      const { core } = state;
      const speaker = state.speakers?.find((candidate) => candidate.id === event.speakerId);
      repair = {
        tick: state.tick,
        amount: event.amount,
        from: litSegments({ hp: core.hp - event.amount, maxHp: core.maxHp }),
        to: litSegments(core),
        toward:
          speaker === undefined ? Math.PI : Math.atan2(speaker.y - core.y, speaker.x - core.x),
      };
    },
    heldFor(segments, now): SegmentSpan {
      const healed = healing(now);
      return healed === null || beatsSinceLanding(healed, now) >= COOLED
        ? { from: segments, to: segments }
        : { from: Math.min(segments, healed.from), to: Math.min(segments, healed.to) };
    },
    shareOf(core, now): number {
      const healed = healing(now);
      return healed !== null && beatsSinceLanding(healed, now) < 0
        ? litShare({ hp: core.hp - healed.amount, maxHp: core.maxHp })
        : litShare(core);
    },
    washOf(now): number {
      const healed = healing(now);
      return healed === null ? 0 : washAt(beatsSinceLanding(healed, now));
    },
    update(state, frame, ringRadius, color): void {
      ring.clear();
      const since =
        repair === null ? Number.POSITIVE_INFINITY : beatsSinceLanding(repair, frame.now);
      const live = repair !== null && since < (repair.amount > 0 ? END : LOST_END);
      if (!live || repair === null) {
        fx.hide();
        return;
      }
      const { core } = state;
      const scale = core.radius / DRAWN_DOME;
      if (repair.amount > 0) {
        if (since < COOLED) {
          drawGained(repair, since, litSegments(core), ringRadius, color, frame);
        }
        drawSpark(repair, since, ringRadius, frame);
        const swell = frame.calm ? 0 : washAt(since) * frame.pulse;
        if (swell > 0) {
          ring
            .circle(0, 0, ringRadius + (7 + 4 * swell) * scale)
            .stroke({ width: 1.6 * scale, color: frame.palette.healer, alpha: 0.35 * swell });
        }
      } else if (!frame.calm && since >= 0 && since < 0.35) {
        ring.circle(0, 0, ringRadius).stroke({
          width: Math.max(2, core.radius * 0.11) + 1,
          color: LOST_GREY,
          alpha: 0.85 * (1 - since / 0.35),
        });
      }
      fx.update(repair, since, core, ringRadius, frame);
    },
    reset(): void {
      repair = null;
      ring.clear();
      fx.hide();
    },
  };
}

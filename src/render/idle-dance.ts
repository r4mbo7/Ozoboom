import type { SetDefinition } from '../data/types';
import { pick, seedRng } from '../shared/prng';
import { clamp01, lerp, smoothstep, wrap } from '../shared/scalar';
import { BEATS_PER_BAR, type Tempo } from '../shared/tempo';
import type { SetSegment } from '../sim/state';

type Foot = 1 | -1;

const D: Foot = 1;
const G: Foot = -1;
const ALTERNATING: readonly Foot[] = [D, G, D, G];

const PATTERNS: readonly (readonly Foot[])[] = [
  ALTERNATING,
  [D, D, G, G],
  [D, D, D, G],
  [G, G, D, G],
  [G, D, D, G],
  [G, G, G, D],
];

const SHIFT = 0.17;
const TURN = 0.16;
const LANDING_SHARE = 0.25;
const SQUASH_PER_HOP = 0.35 / 0.3;
const HOP = { buildup: 0.3, break: 0.2, drop: 0.45 } as const;
const CUT_TICKS = 2;

// `shift` is a share of the radius, + to her right; `turn` in radians; `lift` from 0 to about 0.5.
export interface DancePose {
  shift: number;
  turn: number;
  lift: number;
  squash: number;
}

interface DanceStep {
  readonly hop: number;
  readonly halfTime: boolean;
  readonly downbeatOnly: boolean;
}

// By segment, then whether it hops only on the 1, then calm mode.
function stepsOf(segment: SetSegment): readonly (readonly DanceStep[])[] {
  return [false, true].map((downbeatOnly) =>
    [false, true].map((calm) => ({
      hop: calm ? 0 : HOP[segment],
      halfTime: segment === 'break',
      downbeatOnly,
    })),
  );
}

const STEPS: Readonly<Record<SetSegment, readonly (readonly DanceStep[])[]>> = {
  buildup: stepsOf('buildup'),
  break: stepsOf('break'),
  drop: stepsOf('drop'),
};

function stepOf(segment: SetSegment, hops: SetDefinition['danceHops'], calm: boolean): DanceStep {
  const step = STEPS[segment][hops === 'downbeat' ? 1 : 0]?.[calm ? 1 : 0];
  if (step === undefined) {
    throw new RangeError(`no dance step for the segment ${segment}`);
  }
  return step;
}

function stillPose(): DancePose {
  return { shift: 0, turn: 0, lift: 0, squash: 0 };
}

function scale(pose: DancePose, share: number): void {
  pose.shift *= share;
  pose.turn *= share;
  pose.lift *= share;
  pose.squash *= share;
}

function blend(from: DancePose, into: DancePose, share: number): void {
  into.shift = lerp(from.shift, into.shift, share);
  into.turn = lerp(from.turn, into.turn, share);
  into.lift = lerp(from.lift, into.lift, share);
  into.squash = lerp(from.squash, into.squash, share);
}

function patternOf(seed: number, playerId: number, bar: number): readonly Foot[] {
  const mixed = (seed ^ Math.imul(playerId + 1, 0x9e3779b1) ^ Math.imul(bar, 0x85ebca6b)) >>> 0;
  return pick(seedRng(mixed), PATTERNS);
}

// `beat` counts the step's own beats; the 1 it waits for is the music's, every bar even at half time.
function hopAt(step: DanceStep, beat: number): number {
  const musical = step.halfTime ? 2 * beat : beat;
  return step.downbeatOnly && wrap(musical, BEATS_PER_BAR) !== 0 ? 0 : step.hop;
}

function balance(
  beats: number,
  side: (beat: number) => Foot,
  step: DanceStep,
  into: DancePose,
): void {
  const time = step.halfTime ? beats / 2 : beats;
  const beat = Math.floor(time);
  const share = time - beat;
  const hop = hopAt(step, beat);
  // The beat opens on the press of the hop just landed, if any, then the weight moves.
  const landed = hopAt(step, beat - 1);
  const landing = landed > 0 ? LANDING_SHARE : 0;
  const air = clamp01((share - landing) / (1 - landing));
  const weight = lerp(side(beat), side(beat + 1), smoothstep(air));
  into.shift = SHIFT * weight;
  into.turn = TURN * weight;
  into.lift = share < landing ? 0 : hop * Math.sin(Math.PI * air);
  into.squash =
    share < landing ? SQUASH_PER_HOP * landed * Math.sin((Math.PI * share) / landing) : 0;
}

export interface DanceClock {
  now: number;
  tempo: Tempo;
  seed: number;
  playerId: number;
  segment: SetSegment;
  segmentStartTick: number;
  hops: SetDefinition['danceHops'];
  calm: boolean;
}

export class IdleDance {
  private readonly pose = stillPose();
  private readonly from = stillPose();
  private walkedAt = Number.NaN;
  private walking = false;
  private cutFrom = 0;
  private cutAt = Number.NEGATIVE_INFINITY;
  private segment: SetSegment | null = null;
  private previous: DanceStep | null = null;
  private changedAt = Number.NEGATIVE_INFINITY;
  private seed = Number.NaN;
  private playerId = Number.NaN;
  private readonly bars: [number, number] = [Number.NaN, Number.NaN];
  private readonly patterns: [readonly Foot[], readonly Foot[]] = [ALTERNATING, ALTERNATING];
  private readonly side = (beat: number): Foot => this.foot(beat);

  reset(): void {
    this.walkedAt = Number.NaN;
    this.walking = false;
    this.cutFrom = 0;
    this.cutAt = Number.NEGATIVE_INFINITY;
    this.segment = null;
    this.previous = null;
    this.seed = Number.NaN;
    this.playerId = Number.NaN;
  }

  place(clock: DanceClock, walking: boolean): Readonly<DancePose> {
    const { now, tempo } = clock;
    if (Number.isNaN(this.walkedAt)) {
      this.walkedAt = now;
    }
    if (walking) {
      if (!this.walking) {
        this.cutFrom = this.rise(now, tempo);
        this.cutAt = now;
      }
      this.walkedAt = now;
    }
    this.walking = walking;
    const amount = Math.max(
      this.rise(now, tempo),
      this.cutFrom * clamp01(1 - (now - this.cutAt) / CUT_TICKS),
    );
    const pose = this.pose;
    if (amount <= 0) {
      pose.shift = pose.turn = pose.lift = pose.squash = 0;
      return pose;
    }
    this.follow(clock);
    const beats = (now - tempo.originTick) / tempo.ticksPerBeat;
    balance(beats, this.side, stepOf(clock.segment, clock.hops, clock.calm), pose);
    const settled = smoothstep(clamp01((now - this.changedAt) / tempo.ticksPerBeat));
    if (this.previous !== null && settled < 1) {
      balance(beats, this.side, this.previous, this.from);
      blend(this.from, pose, settled);
    }
    scale(pose, amount);
    return pose;
  }

  private rise(now: number, tempo: Tempo): number {
    return smoothstep(clamp01((now - this.walkedAt - tempo.ticksPerBar) / tempo.ticksPerBar));
  }

  private follow(clock: DanceClock): void {
    if (clock.seed !== this.seed || clock.playerId !== this.playerId) {
      this.seed = clock.seed;
      this.playerId = clock.playerId;
      this.bars[0] = this.bars[1] = Number.NaN;
    }
    if (clock.segment !== this.segment) {
      this.previous = this.segment === null ? null : stepOf(this.segment, clock.hops, clock.calm);
      this.segment = clock.segment;
      this.changedAt = clock.segmentStartTick;
    }
  }

  private foot(beat: number): Foot {
    const bar = Math.floor(beat / BEATS_PER_BAR);
    const slot: 0 | 1 = (bar & 1) === 0 ? 0 : 1;
    if (this.bars[slot] !== bar) {
      this.bars[slot] = bar;
      this.patterns[slot] = patternOf(this.seed, this.playerId, bar);
    }
    return this.patterns[slot][wrap(beat, BEATS_PER_BAR)] ?? D;
  }
}

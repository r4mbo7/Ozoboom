import { type Container, Matrix } from 'pixi.js';
import { clamp, lerp } from '../shared/scalar';
import type { PlayerState, Vec2 } from '../sim/state';

// The body's answer to its walk: it leans toward each change of its walking velocity and squashes along it, then settles with one small overshoot; at full speed it
// stretches a little along the run. A damped spring, stepped once per tick of the simulation.

// The spring was tuned on a body of this radius walking this many units per tick.
const TUNED_RADIUS = 13.5;
const TUNED_SPEED = 2.6;
// About seventeen ticks per wobble, under-damped: one small overshoot, then rest.
const STIFFNESS = 0.13;
const DAMPING = 0.34;
const LEAN_PUSH = 1.5;
const LEAN_KICK = 1.2;
const SQUASH_PUSH = 0.045;
const SQUASH_KICK = 0.03;
// A change of velocity under this, in tuned units, leaves the squash axis where it was; a larger one
// swings it this share of the way toward itself.
const AXIS_TURN = 0.2;
const AXIS_BLEND = 0.6;
const LEAN_MAX = 10;
const SQUASH_MIN = -0.25;
const SQUASH_MAX = 0.38;
// A squashed body widens across by this share of how much it shortens; a running one narrows likewise.
const SQUASH_WIDEN = 0.75;
const RUN_STRETCH = 0.09;
const RUN_NARROW = 0.6;
// Faint on purpose: a fifth of the strength the spring was tuned at.
const STRENGTH = 0.2;
const NEVER = Number.NEGATIVE_INFINITY;
// A frame that skips more ticks than this (a page shown again) finds the spring long settled.
const SETTLE_TICKS = 120;

export interface WalkPose {
  // How far the body leans, in world units.
  leanX: number;
  leanY: number;
  // Shorter along `axis` and wider across when positive, the other way when negative.
  squash: number;
  axis: number;
  // Longer along `heading`, the direction of the walk.
  stretch: number;
  heading: number;
}

export function newWalkPose(): WalkPose {
  return { leanX: 0, leanY: 0, squash: 0, axis: 0, stretch: 0, heading: 0 };
}

export class WalkSpring {
  private tick = NEVER;
  private vx = 0;
  private vy = 0;
  private leanX = 0;
  private leanY = 0;
  private leanSpeedX = 0;
  private leanSpeedY = 0;
  private squash = 0;
  private squashSpeed = 0;
  private axisX = 1;
  private axisY = 0;
  private lastLeanX = 0;
  private lastLeanY = 0;
  private lastSquash = 0;
  private readonly posed = newWalkPose();
  private readonly matrix = new Matrix();

  reset(): void {
    this.tick = NEVER;
    this.vx = this.vy = 0;
    this.leanX = this.leanY = this.leanSpeedX = this.leanSpeedY = 0;
    this.squash = this.squashSpeed = 0;
    this.axisX = 1;
    this.axisY = 0;
    this.lastLeanX = this.lastLeanY = this.lastSquash = 0;
  }

  // Leans `look`, whose children are placed in world units, around the body centre (x, y) this frame.
  lean(
    look: Container,
    tick: number,
    player: Pick<PlayerState, 'walk' | 'speed' | 'radius'>,
    alpha: number,
    x: number,
    y: number,
  ): void {
    this.advance(tick, player.walk, player.speed);
    this.pose(alpha, player.radius, player.speed, this.posed);
    look.setFromMatrix(poseMatrix(this.posed, x, y, this.matrix));
  }

  // With the walking velocity of `tick`; a body first seen already walking takes no kick, and one seen
  // back in time starts over. A frame that skips ticks steps the spring once per tick all the same, the
  // change landing on the first, so it settles in ticks of the simulation, never in rendered frames.
  advance(tick: number, walk: Vec2 | undefined, speed: number): void {
    if (tick === this.tick) {
      return;
    }
    if (tick < this.tick) {
      this.reset();
    }
    const vx = walk?.x ?? 0;
    const vy = walk?.y ?? 0;
    if (this.tick !== NEVER) {
      const steps = Math.min(tick - this.tick, SETTLE_TICKS);
      this.step(vx - this.vx, vy - this.vy, speed);
      for (let skipped = 1; skipped < steps; skipped += 1) {
        this.step(0, 0, speed);
      }
    }
    this.tick = tick;
    this.vx = vx;
    this.vy = vy;
  }

  // Between the last two ticks by `alpha`, for a body of `radius` whose full speed is `speed`.
  pose(alpha: number, radius: number, speed: number, out: WalkPose): WalkPose {
    let leanX = lerp(this.lastLeanX, this.leanX, alpha) * STRENGTH;
    let leanY = lerp(this.lastLeanY, this.leanY, alpha) * STRENGTH;
    const lean = Math.hypot(leanX, leanY);
    const scale =
      (lean > 0 ? (LEAN_MAX * Math.tanh(lean / LEAN_MAX)) / lean : 0) * (radius / TUNED_RADIUS);
    leanX *= scale;
    leanY *= scale;
    out.leanX = leanX;
    out.leanY = leanY;
    out.squash = clamp(
      lerp(this.lastSquash, this.squash, alpha) * STRENGTH,
      SQUASH_MIN,
      SQUASH_MAX,
    );
    out.axis = Math.atan2(this.axisY, this.axisX);
    const run = speed > 0 ? Math.hypot(this.vx, this.vy) / speed : 0;
    out.stretch = run * run * RUN_STRETCH * STRENGTH;
    out.heading = Math.atan2(this.vy, this.vx);
    return out;
  }

  private step(changeX: number, changeY: number, speed: number): void {
    const toTuned = speed > 0 ? TUNED_SPEED / speed : 0;
    const ax = changeX * toTuned;
    const ay = changeY * toTuned;
    const a = Math.hypot(ax, ay);
    this.lastLeanX = this.leanX;
    this.lastLeanY = this.leanY;
    this.lastSquash = this.squash;
    this.leanSpeedX += ax * LEAN_PUSH - STIFFNESS * this.leanX - DAMPING * this.leanSpeedX;
    this.leanSpeedY += ay * LEAN_PUSH - STIFFNESS * this.leanY - DAMPING * this.leanSpeedY;
    this.leanX += this.leanSpeedX + ax * LEAN_KICK;
    this.leanY += this.leanSpeedY + ay * LEAN_KICK;
    this.squashSpeed += a * SQUASH_PUSH - STIFFNESS * this.squash - DAMPING * this.squashSpeed;
    this.squash += this.squashSpeed + a * SQUASH_KICK;
    if (a > AXIS_TURN) {
      this.axisX = this.axisX * (1 - AXIS_BLEND) + (ax / a) * AXIS_BLEND;
      this.axisY = this.axisY * (1 - AXIS_BLEND) + (ay / a) * AXIS_BLEND;
    }
  }
}

export type PoseMatrix = Pick<Matrix, 'a' | 'b' | 'c' | 'd' | 'tx' | 'ty'>;

// A scale by `along` in the direction `angle` and by `across` square to it: [a, bc; bc, d].
interface Directional {
  a: number;
  bc: number;
  d: number;
}

const squashed: Directional = { a: 1, bc: 0, d: 1 };
const stretched: Directional = { a: 1, bc: 0, d: 1 };

function directional(angle: number, along: number, across: number, out: Directional): Directional {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  out.a = along * cos * cos + across * sin * sin;
  out.d = along * sin * sin + across * cos * cos;
  out.bc = (along - across) * cos * sin;
  return out;
}

// The pose around the body centre (cx, cy): squashed along its axis, stretched along its run, then moved
// by its lean. Children placed in world units keep their place when the pose is at rest.
export function poseMatrix<M extends PoseMatrix>(
  pose: WalkPose,
  cx: number,
  cy: number,
  out: M,
): M {
  const s = directional(pose.axis, 1 - pose.squash, 1 + pose.squash * SQUASH_WIDEN, squashed);
  const r = directional(pose.heading, 1 + pose.stretch, 1 - pose.stretch * RUN_NARROW, stretched);
  out.a = s.a * r.a + s.bc * r.bc;
  out.b = s.bc * r.a + s.d * r.bc;
  out.c = s.a * r.bc + s.bc * r.d;
  out.d = s.bc * r.bc + s.d * r.d;
  out.tx = cx + pose.leanX - (out.a * cx + out.c * cy);
  out.ty = cy + pose.leanY - (out.b * cx + out.d * cy);
  return out;
}

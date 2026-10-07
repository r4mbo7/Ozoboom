import type { PlayerState } from '../sim/state';
import type { BurstSpec } from './bursts';
import type { Frame } from './frame';
import { TAU } from './paint';

// What a look needs to draw one standing player for one image. A single object is filled in place
// for every player: nothing is allocated per image.
export interface LookInput {
  player: PlayerState;
  x: number;
  y: number;
  angle: number;
  scale: number;
  color: number;
  teint: number;
  frame: Frame;
  // Ticks since the previous image of this player, clamped.
  dt: number;
  // Share of its top speed, and the same eased in and out, from 0 to 1.
  speed: number;
  moving: number;
  heading: number;
  beatIndex: number;
  sinceBeat: number;
  fireCount: number;
  sinceFire: number;
  sinceHit: number;
  sinceSkill: number;
}

export interface Look {
  // Returns how high the player is lifted, 0 on the ground, for the shadow.
  place(input: LookInput): number;
  hide(): void;
  // A new player takes this view: forget the springs of the previous one.
  reset(): void;
}

export type Spawn = (frame: Frame, spec: BurstSpec) => void;

export function angleTo(from: number, to: number): number {
  let delta = (to - from) % TAU;
  if (delta > Math.PI) {
    delta -= TAU;
  } else if (delta < -Math.PI) {
    delta += TAU;
  }
  return delta;
}

export function lerpAngle(from: number, to: number, share: number): number {
  return from + angleTo(from, to) * share;
}

// A damped spring on one value, stepped in ticks: values[at] is the position, values[at + 1] the
// velocity. Semi-implicit, in steps of at most one tick: a slow image cannot make it blow up.
export function spring(
  values: Float64Array,
  at: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): void {
  step(values, at, target, stiffness, damping, dt, false);
}

// The same on an angle, along the shortest way round.
export function angleSpring(
  values: Float64Array,
  at: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): void {
  step(values, at, target, stiffness, damping, dt, true);
}

function step(
  values: Float64Array,
  at: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
  angle: boolean,
): void {
  const steps = Math.max(1, Math.ceil(dt));
  const tick = dt / steps;
  let position = values[at] ?? 0;
  let velocity = values[at + 1] ?? 0;
  for (let index = 0; index < steps; index += 1) {
    const gap = angle ? angleTo(position, target) : target - position;
    velocity += (stiffness * gap - damping * velocity) * tick;
    position += velocity * tick;
  }
  values[at] = position;
  values[at + 1] = velocity;
}

// A burst of light that fades out over a few ticks after an event: 1 at the event, 0 once gone.
export function fade(sinceTicks: number, lifeTicks: number): number {
  return sinceTicks >= 0 && sinceTicks < lifeTicks * 4 ? Math.exp(-sinceTicks / lifeTicks) : 0;
}

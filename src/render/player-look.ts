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
// velocity. Semi-implicit, stable for the stiffness used here at up to three ticks per image.
export function spring(
  values: Float64Array,
  at: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): void {
  const position = values[at] ?? 0;
  const velocity =
    (values[at + 1] ?? 0) +
    (stiffness * (target - position) - damping * (values[at + 1] ?? 0)) * dt;
  values[at + 1] = velocity;
  values[at] = position + velocity * dt;
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
  const position = values[at] ?? 0;
  const velocity =
    (values[at + 1] ?? 0) +
    (stiffness * angleTo(position, target) - damping * (values[at + 1] ?? 0)) * dt;
  values[at + 1] = velocity;
  values[at] = position + velocity * dt;
}

// A burst of light that fades out over a few ticks after an event: 1 at the event, 0 once gone.
export function fade(sinceTicks: number, lifeTicks: number): number {
  return sinceTicks >= 0 && sinceTicks < lifeTicks * 4 ? Math.exp(-sinceTicks / lifeTicks) : 0;
}

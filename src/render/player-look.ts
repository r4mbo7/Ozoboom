import type { PlayerState, SimState } from '../sim/state';
import type { BurstSpec } from './bursts';
import type { Frame } from './frame';
import { TAU } from './paint';

// Filled in place for every player: nothing is allocated per image.
export interface LookInput {
  state: SimState;
  player: PlayerState;
  x: number;
  y: number;
  angle: number;
  scale: number;
  color: number;
  teint: number;
  frame: Frame;
  dt: number;
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

export function createLookInput(state: SimState, player: PlayerState, frame: Frame): LookInput {
  return {
    state,
    player,
    x: 0,
    y: 0,
    angle: 0,
    scale: 1,
    color: 0,
    teint: 0,
    frame,
    dt: 0,
    speed: 0,
    moving: 0,
    heading: 0,
    beatIndex: 0,
    sinceBeat: 0,
    fireCount: 0,
    sinceFire: Infinity,
    sinceHit: Infinity,
    sinceSkill: Infinity,
  };
}

export interface Look {
  place(input: LookInput): number;
  hide(): void;
  reset?(): void;
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

// Semi-implicit, in steps of at most one tick: a slow image cannot make it blow up.
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

export function fade(sinceTicks: number, lifeTicks: number): number {
  return sinceTicks >= 0 && sinceTicks < lifeTicks * 4 ? Math.exp(-sinceTicks / lifeTicks) : 0;
}

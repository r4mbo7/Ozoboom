import type { TrapEffect } from '../data/types';
import { unitFromAngle } from '../shared/angle';
import type { Tempo } from '../shared/tempo';
import type { Vec2 } from '../shared/vec';
import { sweptDirection } from './sweep';

export type BreezeEffect = Extract<TrapEffect, { kind: 'breeze' }>;

const SWEEP_BARS = 2;

// One bar out and one bar back: every fan sweeps together.
export function breezeDirection(
  effect: BreezeEffect,
  facing: Vec2,
  tick: number,
  tempo: Tempo,
): Vec2 {
  return sweptDirection(facing, effect.sweepDegrees, tick, tempo.ticksPerBar * SWEEP_BARS);
}

// Whether a body stands in the cone: its center inside it, or the body over the fan itself.
export function inBreeze(
  body: Vec2 & { radius: number },
  fan: Vec2,
  direction: Vec2,
  length: number,
  coneDegrees: number,
): boolean {
  const dx = body.x - fan.x;
  const dy = body.y - fan.y;
  const squared = dx * dx + dy * dy;
  if (squared <= body.radius * body.radius) {
    return true;
  }
  if (squared > length * length) {
    return false;
  }
  const along = dx * direction.x + dy * direction.y;
  const halfCone = unitFromAngle((coneDegrees * Math.PI) / 360).x;
  return along >= Math.sqrt(squared) * halfCone;
}

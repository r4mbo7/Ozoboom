import type { TrapEffect } from '../data/types';
import type { Tempo } from '../shared/tempo';
import type { Vec2 } from '../shared/vec';
import { sweptDirection } from './sweep';

export type BeamEffect = Extract<TrapEffect, { kind: 'beam' }>;

// Two beats out and two back, on the bar: every sweeping laser sweeps together.
export function beamDirection(effect: BeamEffect, facing: Vec2, tick: number, tempo: Tempo): Vec2 {
  return effect.sweepDegrees === undefined
    ? facing
    : sweptDirection(facing, effect.sweepDegrees, tick, tempo.ticksPerBar);
}

import type { TrapEffect } from '../data/types';
import type { Tempo } from '../shared/tempo';
import type { Vec2 } from '../shared/vec';
import { beamDirection } from './beam';
import { breezeDirection } from './breeze';

// The sim hurts and the render draws along this one direction.
export function trapPointing(effect: TrapEffect, placed: Vec2, tick: number, tempo: Tempo): Vec2 {
  switch (effect.kind) {
    case 'beam':
      return beamDirection(effect, placed, tick, tempo);
    case 'breeze':
      return breezeDirection(effect, placed, tick, tempo);
    default:
      return placed;
  }
}

import type { DancerLook, SetDefinition } from '../data/types';
import { DANCER, type Dance, BAR_BEATS } from './dance-kit';
import { KID } from './dancer-kid';
import { RAIN } from './dancer-rain';
import { FACE_RADIUS } from './face-kit';
import { NEON_TUBES, neonMask } from './neon-face';
import { paint, type Shape } from './paint';

// The mask flared white before it pops.
const FLARE_LIGHT = 1.7;

export const DANCES: Readonly<Record<DancerLook, Dance>> = { kid: KID, rain: RAIN };

// Who dances under the mask on this stage.
export function lookOf(set: Pick<SetDefinition, 'dancer'>): DancerLook {
  return set.dancer ?? 'kid';
}

// A dance a frame at a time over a bar.
export function paintDance(dance: Dance): Shape[] {
  return Array.from({ length: dance.frames }, (_, index) =>
    paint(
      DANCER.canvas,
      DANCER.canvas,
      DANCER.size,
      (ctx) => {
        dance.draw(ctx, (index / dance.frames) * BAR_BEATS);
      },
      DANCER.density,
    ),
  );
}

export interface Looks {
  // With none, then one, two... of its tubes out.
  readonly masks: readonly Shape[];
  readonly flare: Shape;
}

// His fallen mask.
export function paintLooks(): Looks {
  return {
    masks: Array.from({ length: NEON_TUBES.length + 1 }, (_, out) =>
      paint(144, 144, FACE_RADIUS, (ctx) => {
        neonMask(ctx, 1, out);
      }),
    ),
    flare: paint(144, 144, FACE_RADIUS, (ctx) => {
      neonMask(ctx, FLARE_LIGHT);
    }),
  };
}

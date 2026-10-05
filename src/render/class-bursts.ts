import type { PaletteToken } from '../shared/palette';
import type { PlayerState } from '../sim/state';
import { type BurstSpec, Bursts } from './bursts';
import type { RenderContext } from './context';
import type { Frame } from './frame';

const BURST_CAPACITY = 128;
const CALM = { intensity: 0.55, slower: 1.3 };

export interface Burster {
  readonly bursts: Bursts;
  readonly tokenOf: (player: PlayerState | undefined) => PaletteToken;
  readonly spawn: (frame: Frame, spec: BurstSpec) => void;
}

// The calm mode keeps every effect but lowers its intensity and stretches it, with no spin.
export function createBurster(ctx: RenderContext): Burster {
  const bursts = new Bursts(ctx.layers.fx, BURST_CAPACITY, ctx.textures.ring);
  return {
    bursts,
    tokenOf: (player) => {
      return (player && ctx.classTokens.get(player.classId)) ?? 'or';
    },
    spawn: (frame, spec) => {
      bursts.spawn(
        frame.calm
          ? {
              ...spec,
              peak: spec.peak * CALM.intensity,
              duration: spec.duration * CALM.slower,
              spin: 0,
            }
          : spec,
      );
    },
  };
}

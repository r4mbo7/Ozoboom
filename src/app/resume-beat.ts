import type { AudioEngine } from '../audio/types';
import type { Renderer } from '../render/types';
import type { SimState } from '../sim/state';

export interface ResumeBeat {
  // The page time of the beat the game waits for, its cards answered; null when it does not wait.
  readonly at: number | null;
  // Asks the music, and tells the renderer when the answer changes.
  sync(state: SimState): number | null;
}

export function createResumeBeat(
  audio: Pick<AudioEngine, 'waitsForBeat'>,
  renderer: Pick<Renderer, 'setOptions'>,
): ResumeBeat {
  let at: number | null = null;
  return {
    get at() {
      return at;
    },
    sync(state) {
      const next = audio.waitsForBeat(state);
      if (next !== at) {
        at = next;
        renderer.setOptions({ resumesAt: next });
      }
      return next;
    },
  };
}

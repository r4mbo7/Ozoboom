import type { AudioEngine } from '../audio/types';
import { TRACKS } from '../data/tracks';
import type { GameContent } from '../data/types';
import { createSimulation } from '../sim/index';
import { setOf } from '../sim/lineup';
import type { SimState } from '../sim/state';
import { trackOf } from './track';

// The Programme's « Listen » on a stage: the drop of its first track, played by the game's music on
// the game's clock, a tick per step of the title, until stopped.
export interface StageListen {
  play(setId: string): void;
  stop(): void;
  listening(): boolean;
  step(): void;
}

export function createStageListen(
  content: GameContent,
  audio: Pick<AudioEngine, 'start' | 'setTrack' | 'update'>,
  // The mood follows `listening`.
  changed: () => void,
): StageListen {
  let heard: SimState | null = null;

  return {
    play(setId) {
      if (heard?.setId === setId) {
        return;
      }
      const set = setOf(content, setId);
      const classId = content.classes[0]?.id;
      const trackId = set.trackIds[0];
      if (classId === undefined || trackId === undefined) {
        throw new Error(`No character or track to hear the stage ${setId} with`);
      }
      const { state } = createSimulation({
        seed: 1,
        players: [{ id: 0, classId }],
        setId,
        content,
      });
      state.set = { ...state.set, tier: 0, segment: 'drop', phrase: 0, segmentStartTick: 0 };
      // A drop's boss stands for as long as it plays, so that the drop plays on.
      state.bossesDue = 1;
      state.events = [];
      void audio.start();
      audio.setTrack(trackOf(TRACKS, trackId));
      heard = state;
      changed();
    },
    stop() {
      if (heard !== null) {
        heard = null;
        changed();
      }
    },
    listening: () => heard !== null,
    step() {
      if (heard !== null) {
        heard.tick += 1;
        audio.update(heard);
      }
    },
  };
}

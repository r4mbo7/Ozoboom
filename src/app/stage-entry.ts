import type { AudioEngine } from '../audio/types';
import type { Renderer, StageEntry } from '../render/types';
import { BEATS_PER_BAR, TICK_MS, type Tempo } from '../shared/tempo';
import type { SimState } from '../sim/state';

const ENTRY_BARS = 2;

// Two bars at the tempo of the set, from a sixteenth after `now`: the menus' music leaves first.
export function stageEntry(tempo: Tempo, now: number): StageEntry {
  const beatMs = tempo.ticksPerBeat * TICK_MS;
  const startsAt = now + beatMs / 4;
  return { startsAt, beatMs, landsAt: startsAt + ENTRY_BARS * BEATS_PER_BAR * beatMs };
}

export interface EntryClock {
  // The entry playing, until a bar past its landing; null otherwise.
  readonly entry: StageEntry | null;
  begin(entry: StageEntry): void;
  // Before each step: true while the entry plays, the game held on its first tick and the music
  // landing on it.
  holds(state: SimState, now: number): boolean;
  // A pause that stops the set, or the run left: the game goes on at once when it comes back.
  cancel(): void;
}

export function createEntryClock(
  audio: Pick<AudioEngine, 'enter'>,
  renderer: Pick<Renderer, 'setOptions'>,
): EntryClock {
  let entry: StageEntry | null = null;
  const tell = (next: StageEntry | null) => {
    entry = next;
    renderer.setOptions({ entry: next });
  };
  return {
    get entry() {
      return entry;
    },
    begin: tell,
    holds(state, now) {
      if (entry === null) {
        return false;
      }
      if (now < entry.landsAt) {
        audio.enter(state, entry.landsAt);
        return true;
      }
      if (now >= entry.landsAt + BEATS_PER_BAR * entry.beatMs) {
        tell(null);
      }
      return false;
    },
    cancel() {
      if (entry !== null) {
        tell(null);
      }
    },
  };
}

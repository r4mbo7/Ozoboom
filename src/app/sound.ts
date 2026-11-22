import type { AudioEngine, Mood } from '../audio/types';

export type Screen = 'title' | 'class' | 'stage' | 'lobby' | 'game' | 'ending' | 'end';

export interface SoundScene {
  readonly screen: Screen;
  readonly paused: boolean;
  readonly muted: boolean;
  readonly hidden: boolean;
  // A start waits for its files: a film or `?dev=moment` hears its set from its first frame.
  readonly landing: boolean;
  // The Programme, on the title, plays a stage's music.
  readonly listening: boolean;
}

export interface Sound {
  // Null keeps the mood that plays.
  readonly mood: Mood | null;
  readonly muted: boolean;
}

// A lost set dies out on its own before the ambience comes in.
export function soundOf({ screen, paused, muted, hidden, landing, listening }: SoundScene): Sound {
  return {
    mood: landing
      ? null
      : screen === 'title' && listening
        ? 'set'
        : screen !== 'game'
          ? 'menu'
          : paused
            ? 'pause'
            : 'set',
    muted: muted || hidden,
  };
}

// A Listen of the Programme: a browser suspends the audio in the background, so it resumes first.
export function listen(audio: Pick<AudioEngine, 'start'>, play: () => void): void {
  void audio.start().then(play);
}

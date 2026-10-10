import type { Mood } from '../audio/types';

export type Screen = 'title' | 'stage' | 'lobby' | 'game' | 'ending' | 'end';

export interface SoundScene {
  readonly screen: Screen;
  readonly paused: boolean;
  readonly muted: boolean;
  readonly hidden: boolean;
}

export interface Sound {
  readonly mood: Mood;
  readonly muted: boolean;
}

// The title, the pause, the lobby and the end screen play the chill menu ambience, the game plays the set.
// A lost set dies out on its own before the ambience comes in.
// Everything is silent while the player has turned the sound off or looks away.
export function soundOf({ screen, paused, muted, hidden }: SoundScene): Sound {
  return {
    mood: screen !== 'game' || paused ? 'menu' : 'set',
    muted: muted || hidden,
  };
}

import type { Mood } from '../audio/types';

export type Screen = 'title' | 'class' | 'stage' | 'lobby' | 'game' | 'ending' | 'end';

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

// A lost set dies out on its own before the ambience comes in.
export function soundOf({ screen, paused, muted, hidden }: SoundScene): Sound {
  return {
    mood: screen !== 'game' || paused ? 'menu' : 'set',
    muted: muted || hidden,
  };
}

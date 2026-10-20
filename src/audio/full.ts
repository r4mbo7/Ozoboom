import type { MusicTrack, SetDefinition } from '../data/types';
import type { Music, MusicOptions } from './music';

export const FULL_BAR_CALLS: Readonly<Record<string, never>> = {};
export const FULL_EVENT_CALLS: Readonly<Record<string, never>> = {};
export const FULL_MUSIC: {
  readonly festival?: (
    out: AudioNode,
    options: MusicOptions,
    trackFor?: (set: SetDefinition) => MusicTrack,
  ) => Music;
} = {};

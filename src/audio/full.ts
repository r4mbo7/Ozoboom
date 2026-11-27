import type { MusicTrack, SetDefinition } from '../data/types';
import type { Music, MusicOptions } from './music';
import type { SoundFiles } from './sound-file';

export const FULL_ATTACK_CALLS: Readonly<Record<string, never>> = {};
export const FULL_BAR_CALLS: Readonly<Record<string, never>> = {};
export const FULL_SKILL_CALLS: Readonly<Record<string, never>> = {};
export const FULL_EVENT_CALLS: Readonly<Record<string, never>> = {};
export const FULL_EVENT_VARIANTS: Readonly<Record<string, never>> = {};
export const FULL_SKILL_VOICES = {};
export const FULL_SKILL_LIMITS = {};
export const FULL_BEAT_LIMITS = {};
export const FULL_SPECIAL_TAKES: Readonly<Record<string, never>> = {};
export const FULL_SOUNDS: SoundFiles = {};
export const FULL_SYNTH_LUFS: Readonly<Record<string, number>> = {};
export const FULL_MUSIC: {
  readonly festival?: (
    out: AudioNode,
    options: MusicOptions,
    trackFor?: (set: SetDefinition) => MusicTrack,
  ) => Music;
} = {};

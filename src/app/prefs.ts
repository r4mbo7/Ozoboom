import type { GameContent } from '../data/types';
import { DEFAULT_KEY_PROFILE, type KeyProfile, parseKeyProfile } from '../input/profile';
import { seatName } from '../ui/lobby-model';
import {
  FULL_MIX,
  type SoundBus,
  type SoundLevel,
  type SoundMix,
  VOLUME_STEPS,
} from '../ui/volume';
import { readItem, writeItem } from './storage';

export interface Prefs {
  calmMode: boolean;
  muted: boolean;
  // From 1 to `VOLUME_STEPS`.
  volume: number;
  mix: SoundMix;
  hitSound: boolean;
  autoFire: boolean;
  autoAim: boolean;
  classId: string;
  stageId: string;
  // The next game does not play it again.
  trackId: string;
  endless: boolean;
  festival: boolean;
  keys: KeyProfile;
  // The player's name online and on the leaderboard, '' until typed.
  pseudo: string;
}

const DEFAULT_CLASS_ID = 'mage';

export type StoredPref = Exclude<keyof Prefs, 'mix'>;

const KEYS: Readonly<Record<StoredPref, string>> = {
  calmMode: 'ozoboom.calmMode',
  muted: 'ozoboom.muted',
  volume: 'ozoboom.volume',
  hitSound: 'ozoboom.hitSound',
  autoFire: 'ozoboom.autoFire',
  autoAim: 'ozoboom.autoAim',
  classId: 'ozoboom.classId',
  stageId: 'ozoboom.stageId',
  trackId: 'ozoboom.trackId',
  endless: 'ozoboom.endless',
  festival: 'ozoboom.festival',
  keys: 'ozoboom.keys',
  pseudo: 'ozoboom.pseudo',
};

// Storage can be missing or refused (private browsing, blocked site data, a full quota): the game then plays with the defaults.
export function loadPrefs(storage: () => Storage | null, defaults: Prefs): Prefs {
  return {
    calmMode: readFlag(storage, KEYS.calmMode) ?? defaults.calmMode,
    muted: readFlag(storage, KEYS.muted) ?? defaults.muted,
    volume: readVolume(storage, KEYS.volume) ?? defaults.volume,
    mix: {
      music: readLevel(storage, 'music', defaults.mix.music),
      effects: readLevel(storage, 'effects', defaults.mix.effects),
    },
    hitSound: readFlag(storage, KEYS.hitSound) ?? defaults.hitSound,
    autoFire: readFlag(storage, KEYS.autoFire) ?? defaults.autoFire,
    autoAim: readFlag(storage, KEYS.autoAim) ?? defaults.autoAim,
    classId: readItem(storage, KEYS.classId) ?? defaults.classId,
    stageId: readItem(storage, KEYS.stageId) ?? defaults.stageId,
    trackId: readItem(storage, KEYS.trackId) ?? defaults.trackId,
    endless: readFlag(storage, KEYS.endless) ?? defaults.endless,
    festival: readFlag(storage, KEYS.festival) ?? defaults.festival,
    keys: parseKeyProfile(readItem(storage, KEYS.keys)) ?? defaults.keys,
    pseudo: seatName(readItem(storage, KEYS.pseudo) ?? defaults.pseudo),
  };
}

export function loadPlayerPrefs(
  storage: () => Storage | null,
  content: GameContent,
  calmMode: boolean,
): Prefs {
  const classIds = content.classes.map((definition) => definition.id);
  const firstSetId = content.sets[0]?.id ?? '';
  const prefs = loadPrefs(storage, {
    calmMode,
    muted: false,
    volume: VOLUME_STEPS,
    mix: FULL_MIX,
    hitSound: false,
    autoFire: true,
    autoAim: true,
    classId: DEFAULT_CLASS_ID,
    stageId: firstSetId,
    trackId: '',
    endless: false,
    festival: false,
    keys: DEFAULT_KEY_PROFILE,
    pseudo: '',
  });
  if (!classIds.includes(prefs.classId)) {
    prefs.classId = classIds.includes(DEFAULT_CLASS_ID) ? DEFAULT_CLASS_ID : (classIds[0] ?? '');
  }
  if (!content.sets.some((definition) => definition.id === prefs.stageId)) {
    prefs.stageId = firstSetId;
  }
  return prefs;
}

export function savePref<K extends StoredPref>(
  storage: () => Storage | null,
  key: K,
  value: Prefs[K],
): void {
  writeItem(storage, KEYS[key], stored(value));
}

export function saveLevel(storage: () => Storage | null, bus: SoundBus, level: SoundLevel): void {
  const keys = levelKeys(bus);
  writeItem(storage, keys.volume, stored(level.volume));
  writeItem(storage, keys.muted, stored(level.muted));
}

function levelKeys(bus: SoundBus): { readonly volume: string; readonly muted: string } {
  return { volume: `ozoboom.${bus}Volume`, muted: `ozoboom.${bus}Muted` };
}

function readLevel(storage: () => Storage | null, bus: SoundBus, fallback: SoundLevel): SoundLevel {
  const keys = levelKeys(bus);
  return {
    volume: readVolume(storage, keys.volume) ?? fallback.volume,
    muted: readFlag(storage, keys.muted) ?? fallback.muted,
  };
}

function stored(value: Prefs[StoredPref]): string {
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function readFlag(storage: () => Storage | null, key: string): boolean | null {
  const value = readItem(storage, key);
  return value === '1' ? true : value === '0' ? false : null;
}

function readVolume(storage: () => Storage | null, key: string): number | null {
  const value = Number(readItem(storage, key));
  return Number.isInteger(value) && value >= 1 && value <= VOLUME_STEPS ? value : null;
}

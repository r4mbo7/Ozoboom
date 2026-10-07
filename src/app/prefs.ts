import { VOLUME_STEPS } from '../ui/volume';

export interface Prefs {
  calmMode: boolean;
  muted: boolean;
  // From 1 to `VOLUME_STEPS`.
  volume: number;
  autoFire: boolean;
  autoAim: boolean;
  // The class of a solo game: the last one chosen on the title.
  classId: string;
  // The track of the last game, which the next one does not play.
  trackId: string;
}

const KEYS: Readonly<Record<keyof Prefs, string>> = {
  calmMode: 'ozoboom.calmMode',
  muted: 'ozoboom.muted',
  volume: 'ozoboom.volume',
  autoFire: 'ozoboom.autoFire',
  autoAim: 'ozoboom.autoAim',
  classId: 'ozoboom.classId',
  trackId: 'ozoboom.trackId',
};

// Storage can be missing or throw (private browsing, blocked site data): the game then plays with
// the defaults and forgets the choice.
export function loadPrefs(storage: () => Storage, defaults: Prefs): Prefs {
  return {
    calmMode: readFlag(storage, KEYS.calmMode) ?? defaults.calmMode,
    muted: readFlag(storage, KEYS.muted) ?? defaults.muted,
    volume: readVolume(storage, KEYS.volume) ?? defaults.volume,
    autoFire: readFlag(storage, KEYS.autoFire) ?? defaults.autoFire,
    autoAim: readFlag(storage, KEYS.autoAim) ?? defaults.autoAim,
    classId: readText(storage, KEYS.classId) ?? defaults.classId,
    trackId: readText(storage, KEYS.trackId) ?? defaults.trackId,
  };
}

export function savePref<K extends keyof Prefs>(
  storage: () => Storage,
  key: K,
  value: Prefs[K],
): void {
  try {
    storage().setItem(KEYS[key], typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  } catch {
    // Not remembered: the choice still applies to this visit.
  }
}

function readFlag(storage: () => Storage, key: string): boolean | null {
  const value = readText(storage, key);
  return value === '1' ? true : value === '0' ? false : null;
}

function readVolume(storage: () => Storage, key: string): number | null {
  const value = Number(readText(storage, key));
  return Number.isInteger(value) && value >= 1 && value <= VOLUME_STEPS ? value : null;
}

function readText(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

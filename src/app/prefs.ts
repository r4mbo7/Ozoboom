export interface Prefs {
  calmMode: boolean;
  muted: boolean;
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
    storage().setItem(KEYS[key], typeof value === 'boolean' ? (value ? '1' : '0') : value);
  } catch {
    // Not remembered: the choice still applies to this visit.
  }
}

function readFlag(storage: () => Storage, key: string): boolean | null {
  const value = readText(storage, key);
  return value === '1' ? true : value === '0' ? false : null;
}

function readText(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

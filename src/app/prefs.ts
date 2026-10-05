export interface Prefs {
  calmMode: boolean;
  muted: boolean;
  // The class of a solo game: the last one chosen on the title.
  classId: string;
}

const KEYS: Readonly<Record<keyof Prefs, string>> = {
  calmMode: 'ozoboom.calmMode',
  muted: 'ozoboom.muted',
  classId: 'ozoboom.classId',
};

// Storage can be missing or throw (private browsing, blocked site data): the game then plays with
// the defaults and forgets the choice.
export function loadPrefs(storage: () => Storage, defaults: Prefs): Prefs {
  return {
    calmMode: readFlag(storage, KEYS.calmMode) ?? defaults.calmMode,
    muted: readFlag(storage, KEYS.muted) ?? defaults.muted,
    classId: readText(storage, KEYS.classId) ?? defaults.classId,
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

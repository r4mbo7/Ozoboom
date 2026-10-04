export interface Prefs {
  calmMode: boolean;
  muted: boolean;
}

const KEYS: Readonly<Record<keyof Prefs, string>> = {
  calmMode: 'ozoboom.calmMode',
  muted: 'ozoboom.muted',
};

// Storage can be missing or throw (private browsing, blocked site data): the game then plays with
// the defaults and forgets the choice.
export function loadPrefs(storage: () => Storage, defaults: Prefs): Prefs {
  return {
    calmMode: readFlag(storage, KEYS.calmMode) ?? defaults.calmMode,
    muted: readFlag(storage, KEYS.muted) ?? defaults.muted,
  };
}

export function savePref(storage: () => Storage, key: keyof Prefs, value: boolean): void {
  try {
    storage().setItem(KEYS[key], value ? '1' : '0');
  } catch {
    // Not remembered: the choice still applies to this visit.
  }
}

function readFlag(storage: () => Storage, key: string): boolean | null {
  try {
    const value = storage().getItem(key);
    return value === '1' ? true : value === '0' ? false : null;
  } catch {
    return null;
  }
}

// Firefox with storage turned off and a WebView without DOM storage give none at all, and a
// browser policy that blocks storage refuses even the lookup.
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch (error) {
    if (error instanceof DOMException) {
      return null;
    }
    throw error;
  }
}

// A refused storage reads as empty and keeps nothing; anything else is a bug and surfaces.
export function readItem(storage: () => Storage | null, key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch (error) {
    if (error instanceof DOMException) {
      return null;
    }
    throw error;
  }
}

export function writeItem(storage: () => Storage | null, key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch (error) {
    if (!(error instanceof DOMException)) {
      throw error;
    }
  }
}

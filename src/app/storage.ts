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

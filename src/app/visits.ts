import { isRecord } from '../shared/guards';

const PUBLISHED_HOST = 'r4mbo7.github.io';
const COUNTER_URL = 'https://abacus.jasoncameron.dev/hit/r4mbo7-ozoboom/visits';

// Null when the counter is unreachable: a missing total must never get in the way of playing.
export async function countVisit(
  host: string,
  fetchCounter: (url: string) => Promise<Response>,
): Promise<number | null> {
  if (host !== PUBLISHED_HOST) return null;
  try {
    const response = await fetchCounter(COUNTER_URL);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return isRecord(body) && typeof body.value === 'number' ? body.value : null;
  } catch (error) {
    // A browser aborts the request as the page leaves.
    if (
      error instanceof TypeError ||
      error instanceof SyntaxError ||
      error instanceof DOMException
    ) {
      return null;
    }
    throw error;
  }
}

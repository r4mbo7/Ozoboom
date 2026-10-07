const PUBLISHED_HOST = 'r4mbo7.github.io';
const COUNTER_URL = 'https://abacus.jasoncameron.dev/hit/r4mbo7-ozoboom/visits';

// Counts this visit to the published game and returns the total, or null when the counter is
// unreachable: a missing total must never get in the way of playing.
export async function countVisit(
  host: string,
  fetchCounter: (url: string) => Promise<Response>,
): Promise<number | null> {
  if (host !== PUBLISHED_HOST) return null;
  try {
    const response = await fetchCounter(COUNTER_URL);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const value = (body as { value?: unknown } | null)?.value;
    return typeof value === 'number' ? value : null;
  } catch {
    return null;
  }
}

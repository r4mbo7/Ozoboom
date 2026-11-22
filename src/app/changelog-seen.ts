import { readItem, writeItem } from './storage';

const KEY = 'ozoboom.changelogSeen';

export function seeChangelog(storage: () => Storage | null, latest: string | undefined): void {
  if (latest !== undefined) {
    writeItem(storage, KEY, latest);
  }
}

// A first visit has nothing to catch up on: the current release counts as seen.
export function changelogNews(storage: () => Storage | null, latest: string | undefined): boolean {
  const seen = readItem(storage, KEY);
  if (seen === null) {
    seeChangelog(storage, latest);
    return false;
  }
  return latest !== undefined && seen !== latest;
}

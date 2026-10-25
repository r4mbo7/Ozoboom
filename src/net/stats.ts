import { isRecord } from '../shared/guards';

interface StatEntry {
  id?: string;
  type: string;
  state?: string;
  nominated?: boolean;
  selected?: boolean;
  selectedCandidatePairId?: string;
  currentRoundTripTime?: number;
}

// In ms. The guest may never see `nominated`: the pair the transport selected comes first, then any nominated, selected or succeeded one.
export function roundTripFromStats(entries: Iterable<unknown>): number | null {
  const all = [...entries].filter(isStatEntry);
  const pairs = all.filter(
    (stat) => stat.type === 'candidate-pair' && (stat.currentRoundTripTime ?? 0) > 0,
  );
  const selectedIds = new Set(
    all.map((stat) => stat.selectedCandidatePairId).filter((id) => id !== undefined),
  );
  const rank = (pair: StatEntry): number => {
    if (pair.id !== undefined && selectedIds.has(pair.id)) return 0;
    if (pair.nominated === true || pair.selected === true) return 1;
    return pair.state === 'succeeded' ? 2 : 3;
  };
  const best = Math.min(...pairs.map(rank));
  const measures = pairs
    .filter((pair) => rank(pair) === best && best < 3)
    .map((pair) => (pair.currentRoundTripTime ?? 0) * 1000);
  return measures.length === 0 ? null : Math.min(...measures);
}

function isStatEntry(value: unknown): value is StatEntry {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    isOptional(value.id, 'string') &&
    isOptional(value.state, 'string') &&
    isOptional(value.nominated, 'boolean') &&
    isOptional(value.selected, 'boolean') &&
    isOptional(value.selectedCandidatePairId, 'string') &&
    isOptional(value.currentRoundTripTime, 'number')
  );
}

function isOptional(value: unknown, type: 'string' | 'number' | 'boolean'): boolean {
  return value === undefined || typeof value === type;
}

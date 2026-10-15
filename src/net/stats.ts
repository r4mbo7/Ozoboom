export interface StatEntry {
  id?: string;
  type: string;
  state?: string;
  nominated?: boolean;
  selected?: boolean;
  selectedCandidatePairId?: string;
  currentRoundTripTime?: number;
}

// The round trip, in ms, of the connection in use from an RTCStatsReport. Which pair is flagged
// differs by side and browser: the controlled side (the guest) may never see `nominated`, so the
// pair the transport selected comes first, then any nominated, selected or succeeded pair.
export function roundTripFromStats(entries: Iterable<StatEntry>): number | null {
  const all = [...entries];
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

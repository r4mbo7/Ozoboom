import type { GameContent, SetDefinition, TierDefinition } from '../data/types';
import { TICKS_PER_BEAT, TICK_RATE_HZ, tempoOf, type Tempo } from '../shared/tempo';
import type { GameStatus, SetProgress } from './state';

export type LineupSlotKind = 'phrase' | 'break' | 'drop' | 'sunrise';

export interface LineupSlot {
  kind: LineupSlotKind;
  tier: number;
  phrase: number;
}

export interface LineupCursor {
  slot: number;
  fraction: number | null;
}

export interface LineupInput {
  tick: number;
  status: GameStatus;
  set: Pick<SetProgress, 'tier' | 'segment' | 'segmentStartTick' | 'endlessFromTick'>;
}

export function setOf(content: GameContent, setId: string): SetDefinition {
  const set = [...content.sets, ...(content.paths ?? [])].find(
    (candidate) => candidate.id === setId,
  );
  if (set === undefined) {
    throw new Error(`unknown set "${setId}"`);
  }
  return set;
}

const TEMPOS = new WeakMap<SetDefinition, Map<number, Tempo>>();

// Its grid counts from `startTick`, the tick the set started at (ADR 0018).
export function setTempo(set: SetDefinition, startTick = 0): Tempo {
  let byStart = TEMPOS.get(set);
  if (byStart === undefined) {
    byStart = new Map();
    TEMPOS.set(set, byStart);
  }
  let tempo = byStart.get(startTick);
  if (tempo === undefined) {
    tempo = tempoOf(set.ticksPerBeat ?? TICKS_PER_BEAT, startTick);
    byStart.set(startTick, tempo);
  }
  return tempo;
}

export function playedTempo(
  set: SetDefinition,
  state: { set: Pick<SetProgress, 'startTick'> },
): Tempo {
  return setTempo(set, state.set.startTick ?? 0);
}

export function lineupSlots(set: SetDefinition): LineupSlot[] {
  const slots: LineupSlot[] = [];
  set.tiers.forEach((tier, index) => {
    for (let phrase = 0; phrase < tier.buildupPhrases; phrase += 1) {
      slots.push({ kind: 'phrase', tier: index, phrase });
    }
    slots.push({ kind: 'break', tier: index, phrase: 0 });
    slots.push({ kind: 'drop', tier: index, phrase: 0 });
  });
  slots.push({ kind: 'sunrise', tier: set.tiers.length, phrase: 0 });
  return slots;
}

export function lineupCursor(set: SetDefinition, state: LineupInput): LineupCursor {
  const tier = set.tiers[state.set.tier];
  const { ticksPerBar, ticksPerPhrase } = setTempo(set);
  if (state.status === 'won' || tier === undefined) {
    return { slot: slotCount(set.tiers) - 1, fraction: 1 };
  }
  const base = slotCount(set.tiers.slice(0, state.set.tier)) - 1;
  const elapsed = elapsedInSegment(state);
  switch (state.set.segment) {
    case 'buildup': {
      const phrase = Math.min(Math.floor(elapsed / ticksPerPhrase), tier.buildupPhrases - 1);
      const fraction = (elapsed - phrase * ticksPerPhrase) / ticksPerPhrase;
      return { slot: base + phrase, fraction: Math.min(1, fraction) };
    }
    case 'break': {
      const length = tier.breakBars * ticksPerBar;
      return {
        slot: base + tier.buildupPhrases,
        fraction: length === 0 ? 1 : Math.min(1, elapsed / length),
      };
    }
    case 'drop':
      return { slot: base + tier.buildupPhrases + 1, fraction: null };
  }
}

export function setFraction(set: SetDefinition, state: LineupInput): number {
  // A set without a tier is a path between two stages: it walks into the dusk of the next one.
  if (set.tiers.length === 0) {
    return 0;
  }
  const slots = slotCount(set.tiers);
  // The last tier starts over in an endless game: the hour holds where its drop left it.
  if (typeof state.set.endlessFromTick === 'number' && state.status !== 'won') {
    return (slots - 1) / slots;
  }
  const { slot, fraction } = lineupCursor(set, state);
  const inSlot = fraction ?? Math.min(1, elapsedInSegment(state) / (4 * setTempo(set).ticksPerBar));
  return (slot + inSlot) / slots;
}

export function ticksToDrop(set: SetDefinition, state: LineupInput): number | null {
  const tier = set.tiers[state.set.tier];
  if (state.status === 'won' || tier === undefined || state.set.segment === 'drop') {
    return null;
  }
  const { ticksPerBar, ticksPerPhrase } = setTempo(set);
  const breakTicks = tier.breakBars * ticksPerBar;
  const segmentTicks =
    state.set.segment === 'buildup'
      ? tier.buildupPhrases * ticksPerPhrase + breakTicks
      : breakTicks;
  return Math.max(0, segmentTicks - elapsedInSegment(state));
}

function elapsedInSegment(state: LineupInput): number {
  return Math.max(0, state.tick - state.set.segmentStartTick);
}

function slotCount(tiers: readonly TierDefinition[]): number {
  return tiers.reduce((count, tier) => count + tier.buildupPhrases + 2, 1);
}

// A drop lasts as long as its boss stands: about this long.
const DROP_SECONDS = 45;

export function stageMinutes(set: SetDefinition): number {
  const { ticksPerBar, ticksPerPhrase } = setTempo(set);
  const ticks = set.tiers.reduce(
    (sum, tier) =>
      sum +
      tier.buildupPhrases * ticksPerPhrase +
      tier.breakBars * ticksPerBar +
      DROP_SECONDS * TICK_RATE_HZ,
    0,
  );
  return Math.round(ticks / (60 * TICK_RATE_HZ));
}

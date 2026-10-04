import type { GameContent, SetDefinition, TierDefinition } from '../data/types';
import { TICKS_PER_BAR, TICKS_PER_PHRASE } from '../shared/tempo';
import type { GameStatus, SetProgress } from './state';

const DROP_RAMP_TICKS = 4 * TICKS_PER_BAR;

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
  set: Pick<SetProgress, 'tier' | 'segment' | 'segmentStartTick'>;
}

export function setOf(content: GameContent, setId: string): SetDefinition {
  const set = content.sets.find((candidate) => candidate.id === setId);
  if (set === undefined) {
    throw new Error(`unknown set "${setId}"`);
  }
  return set;
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
  if (state.status === 'won' || tier === undefined) {
    return { slot: slotCount(set.tiers) - 1, fraction: 1 };
  }
  const base = slotCount(set.tiers.slice(0, state.set.tier)) - 1;
  const elapsed = elapsedInSegment(state);
  switch (state.set.segment) {
    case 'buildup': {
      const phrase = Math.min(Math.floor(elapsed / TICKS_PER_PHRASE), tier.buildupPhrases - 1);
      const fraction = (elapsed - phrase * TICKS_PER_PHRASE) / TICKS_PER_PHRASE;
      return { slot: base + phrase, fraction: Math.min(1, fraction) };
    }
    case 'break': {
      const length = tier.breakBars * TICKS_PER_BAR;
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
  const { slot, fraction } = lineupCursor(set, state);
  const inSlot = fraction ?? Math.min(1, elapsedInSegment(state) / DROP_RAMP_TICKS);
  return (slot + inSlot) / slotCount(set.tiers);
}

export function ticksToDrop(set: SetDefinition, state: LineupInput): number | null {
  const tier = set.tiers[state.set.tier];
  if (state.status === 'won' || tier === undefined || state.set.segment === 'drop') {
    return null;
  }
  const breakTicks = tier.breakBars * TICKS_PER_BAR;
  const segmentTicks =
    state.set.segment === 'buildup'
      ? tier.buildupPhrases * TICKS_PER_PHRASE + breakTicks
      : breakTicks;
  return Math.max(0, segmentTicks - elapsedInSegment(state));
}

function elapsedInSegment(state: LineupInput): number {
  return Math.max(0, state.tick - state.set.segmentStartTick);
}

function slotCount(tiers: readonly TierDefinition[]): number {
  return tiers.reduce((count, tier) => count + tier.buildupPhrases + 2, 1);
}

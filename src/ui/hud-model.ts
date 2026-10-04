import type { GameContent, SetDefinition, WeaponDefinition } from '../data/types';
import { NIGHT_END, NIGHT_START, type PaletteToken } from '../shared/palette';
import { TICKS_PER_BAR } from '../shared/tempo';
import type { PlayerState, SimState } from '../sim/state';
import { ratio } from './format';

const SPEAKER_TOKENS: Readonly<Record<string, PaletteToken>> = {
  'dome-chill': 'healer',
  foret: 'turquoise',
  sub: 'or',
  'cercle-acid': 'mage',
};

const FALLBACK_TOKENS: readonly PaletteToken[] = ['healer', 'turquoise', 'or', 'mage'];

export const GEAR_SLOTS = 3;

export function speakerToken(id: string, index: number): PaletteToken {
  return SPEAKER_TOKENS[id] ?? FALLBACK_TOKENS[index % FALLBACK_TOKENS.length] ?? 'or';
}

export type CranState = 'off' | 'plugging' | 'on';

export interface Cran {
  id: string;
  name: string;
  token: PaletteToken;
  state: CranState;
  fill: number;
}

export function volumeCrans(set: SetDefinition, state: SimState): Cran[] {
  return (set.speakers ?? []).map((definition, index) => {
    const speaker = state.speakers?.find((candidate) => candidate.id === definition.id);
    const needed = definition.plugBars * TICKS_PER_BAR;
    const fill = speaker?.plugged === true ? 1 : ratio(speaker?.plugTicks ?? 0, needed);
    const cranState: CranState = speaker?.plugged === true ? 'on' : fill > 0 ? 'plugging' : 'off';
    return {
      id: definition.id,
      name: definition.name,
      token: speakerToken(definition.id, index),
      state: cranState,
      fill,
    };
  });
}

export function trapCapacity(set: SetDefinition, state: Pick<SimState, 'volume'>): number {
  return set.maxTraps + (state.volume ?? 0);
}

const COUNT_WORDS = ['zéro', 'une', 'deux', 'trois', 'quatre'];

export function plugHelp(bars: number): string {
  const word = COUNT_WORDS[bars] ?? String(bars);
  return `Reste ${word} mesure${bars > 1 ? 's' : ''} pour brancher`;
}

// The unplugged speaker a living player stands in, if any.
export function enteredSpeaker(set: SetDefinition, state: SimState): { plugBars: number } | null {
  for (const speaker of state.speakers ?? []) {
    if (speaker.plugged) {
      continue;
    }
    const inside = state.players.some(
      (player) =>
        !player.downed && Math.hypot(player.x - speaker.x, player.y - speaker.y) <= speaker.radius,
    );
    const definition = set.speakers?.find((candidate) => candidate.id === speaker.id);
    if (inside && definition !== undefined) {
      return { plugBars: definition.plugBars };
    }
  }
  return null;
}

export interface GearSlotView {
  weapon: WeaponDefinition | null;
  level: number;
}

export function gearSlots(
  player: Pick<PlayerState, 'weapons'>,
  content: GameContent,
): GearSlotView[] {
  return Array.from({ length: GEAR_SLOTS }, (_, index) => {
    const slot = player.weapons?.[index];
    const weapon = content.weapons?.find((candidate) => candidate.id === slot?.id) ?? null;
    return weapon === null || slot === undefined
      ? { weapon: null, level: 0 }
      : { weapon, level: slot.level };
  });
}

export function isNight(fraction: number): boolean {
  return fraction >= NIGHT_START && fraction < NIGHT_END;
}

export interface SlotEdges {
  left: number;
  width: number;
}

// Where the sun sits on the line-up, as a share of its track: the set fraction is the slot it is in
// plus how far through that slot it is, so the sun crosses each slot as the slot fills.
export function sunPosition(fraction: number, slots: readonly SlotEdges[]): number {
  const count = slots.length;
  if (count === 0) {
    return 0;
  }
  const at = Math.min(1, Math.max(0, fraction)) * count;
  const index = Math.min(Math.floor(at), count - 1);
  const slot = slots[index];
  return slot === undefined ? 0 : slot.left + (at - index) * slot.width;
}

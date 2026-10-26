import type {
  GameContent,
  GaugeDefinition,
  SetDefinition,
  SkillDefinition,
  SummonLook,
  TrapDefinition,
  WeaponDefinition,
} from '../data/types';
import { t, tn } from '../shared/i18n';
import { NIGHT_END, NIGHT_START, type PaletteToken, isClassToken } from '../shared/palette';
import { clamp01 } from '../shared/scalar';
import { type LineupSlot, setTempo, ticksToDrop } from '../sim/lineup';
import type { PlayerState, SimState } from '../sim/state';
import { gaugeValue } from '../sim/gauges';
import { skillCooldownTicks } from '../sim/stats';
import { trapAt } from '../sim/systems/traps';
import { formatDuration, formatNumber, formatPercent, ratio } from './format';
import { defaultName } from './lobby-model';
import type { UiFrame } from './types';

export function skillCharge(
  player: Pick<PlayerState, 'modifiers' | 'skillCooldown'>,
  skill: Pick<SkillDefinition, 'cooldownTicks'>,
): number {
  return 1 - ratio(player.skillCooldown, skillCooldownTicks(player, skill));
}

export interface GaugeReading {
  fill: number;
  notches: number;
  full: boolean;
  text: string;
}

export function gaugeNotches(gauge: Pick<GaugeDefinition, 'max'>): number {
  return gauge.max > 1 && Number.isInteger(gauge.max) ? gauge.max : 0;
}

export function gaugeReading(
  player: Pick<PlayerState, 'gauge'>,
  gauge: Pick<GaugeDefinition, 'max'>,
): GaugeReading {
  const value = gaugeValue(player);
  const fill = ratio(value, gauge.max);
  const notches = gaugeNotches(gauge);
  const full = fill >= 1;
  const text = full
    ? t('À fond')
    : notches > 0
      ? t('{value} sur {max}', {
          value: formatNumber(Math.floor(value)),
          max: formatNumber(notches),
        })
      : formatPercent(Math.floor(fill * 100 + 1e-6) / 100);
  return { fill, notches, full, text };
}

export function classToken(classId: string): PaletteToken {
  return isClassToken(classId) ? classId : 'or';
}

const DANGER_RATIO = 0.25;

export function inDanger(
  players: readonly Pick<PlayerState, 'hp' | 'maxHp' | 'downed'>[],
): boolean {
  return players.some((player) => !player.downed && ratio(player.hp, player.maxHp) <= DANGER_RATIO);
}

export function allDown(players: readonly Pick<PlayerState, 'downed'>[]): boolean {
  return players.length > 0 && players.every((player) => player.downed);
}

export function playerLabel(player: Pick<PlayerState, 'id' | 'name'>): string {
  return player.name ?? defaultName(player.id);
}

export interface Roster {
  // More than one player in the sim: a band per player; alone, the solo HUD.
  team: boolean;
  // In the order of the frame.
  locals: PlayerState[];
  // Remote players, in the order of the sim.
  others: PlayerState[];
}

export function rosterOf(
  state: Pick<SimState, 'players'>,
  frame: Pick<UiFrame, 'players'>,
): Roster {
  const locals = frame.players.flatMap((local) => {
    const player = state.players.find((candidate) => candidate.id === local.playerId);
    return player === undefined ? [] : [player];
  });
  return {
    team: state.players.length > 1,
    locals,
    others: state.players.filter((player) => !locals.includes(player)),
  };
}

// On a shared screen every player wears a bracelet; online, the players of other screens do.
export function braceletedPlayers(roster: Roster): PlayerState[] {
  const locals = roster.team ? roster.locals : [];
  return locals.length > 1 ? [...locals, ...roster.others] : roster.others;
}

const SPEAKER_TOKENS: Readonly<Record<string, PaletteToken>> = {
  'dome-chill': 'healer',
  foret: 'turquoise',
  sub: 'or',
  'cercle-acid': 'mage',
};

const FALLBACK_TOKENS: readonly PaletteToken[] = ['healer', 'turquoise', 'or', 'mage'];

const NEAR_LEVEL = 0.8;

export interface LevelReading {
  fill: number;
  gained: boolean;
  levelled: boolean;
  near: boolean;
}

export function levelReading(
  shown: Pick<PlayerState, 'level' | 'vibes'> | null,
  player: Pick<PlayerState, 'level' | 'vibes' | 'vibesToNextLevel'>,
): LevelReading {
  const fill = ratio(player.vibes, player.vibesToNextLevel);
  const levelled = shown !== null && player.level > shown.level;
  const gained =
    levelled || (shown !== null && player.level === shown.level && player.vibes > shown.vibes);
  return { fill, gained, levelled, near: fill >= NEAR_LEVEL };
}

const GEAR_SLOTS = 3;

function speakerToken(id: string, index: number): PaletteToken {
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
  const { ticksPerBar } = setTempo(set);
  return (set.speakers ?? []).map((definition, index) => {
    const speaker = state.speakers?.find((candidate) => candidate.id === definition.id);
    const needed = definition.plugBars * ticksPerBar;
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

export interface HandTile {
  trapId: string | null;
  available: boolean;
  // The slot after the traps holds an offering for the fire or a giant.
  offering?: true;
  // Every trap slot of the team is taken: the trap waits for one to be taken back.
  full?: true;
}

export function trapToTake(
  definitions: ReadonlyMap<string, Pick<TrapDefinition, 'radius'>>,
  state: Pick<SimState, 'traps'>,
  player: Pick<PlayerState, 'x' | 'y' | 'hand' | 'offering'>,
  handSize: number,
): string | null {
  const under = trapAt(definitions, state.traps, player);
  const held = (player.hand?.length ?? 0) + (player.offering === undefined ? 0 : 1);
  return under === undefined || held >= handSize ? null : under.kind;
}

// A held trap is available unless the field is full or a trap stands where it would go.
export function handTiles(
  definitions: ReadonlyMap<string, Pick<TrapDefinition, 'radius'>>,
  state: Pick<SimState, 'traps'>,
  player: Pick<PlayerState, 'x' | 'y' | 'hand' | 'offering'>,
  handSize: number,
  capacity: number,
): HandTile[] {
  const full = trapsFull(state, capacity);
  const free = !full && trapAt(definitions, state.traps, player) === undefined;
  const traps = player.hand?.length ?? 0;
  return Array.from({ length: handSize }, (_, index): HandTile => {
    if (index === traps && player.offering !== undefined) {
      return { trapId: null, available: false, offering: true };
    }
    const trapId = player.hand?.[index] ?? null;
    if (trapId !== null && full) {
      return { trapId, available: false, full: true };
    }
    return { trapId, available: trapId !== null && free };
  });
}

export function trapTileTitle(
  tile: HandTile,
  trap: Pick<TrapDefinition, 'name' | 'description'> | undefined,
  look: SummonLook | undefined,
): string {
  if (tile.offering === true) {
    return look === 'giants' ? t('Des spores, à porter à un géant') : t('Un bâton, à jeter au feu');
  }
  return trap === undefined
    ? t('Main libre')
    : t('{name} : {description}', { name: t(trap.name), description: t(trap.description) });
}

export function trapsFull(state: Pick<SimState, 'traps'>, capacity: number): boolean {
  return state.traps.length >= capacity;
}

// The count of the slots taken, shown only once none is left.
export function trapSlotsFull(state: Pick<SimState, 'traps'>, capacity: number): string | null {
  return trapsFull(state, capacity)
    ? t('{taken}/{capacity}', {
        taken: formatNumber(state.traps.length),
        capacity: formatNumber(capacity),
      })
    : null;
}

export function trapCaption(
  definitions: ReadonlyMap<string, Pick<TrapDefinition, 'name'>>,
  taken: string | null,
  held: string | undefined,
  full: boolean,
): string | null {
  const name = (id: string | undefined) => {
    const trap = id === undefined ? undefined : definitions.get(id);
    return trap === undefined ? '' : t(trap.name);
  };
  if (taken !== null) {
    return t('Reprendre : {trap}', { trap: name(taken) });
  }
  if (held === undefined) {
    return null;
  }
  return full ? t('Plus de place pour un piège : reprends-en un') : name(held);
}

const plugHelps = (): readonly string[] => [
  t('Reste zéro mesure pour brancher'),
  t('Reste une mesure pour brancher'),
  t('Reste deux mesures pour brancher'),
  t('Reste trois mesures pour brancher'),
  t('Reste quatre mesures pour brancher'),
];

export function plugHelp(bars: number): string {
  return (
    plugHelps()[bars] ??
    tn(bars, 'Reste {bars} mesure pour brancher', 'Reste {bars} mesures pour brancher', {
      bars: formatNumber(bars),
    })
  );
}

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

export interface PlugHelp {
  readonly seen: boolean;
  readonly text: string | null;
}

export const NO_PLUG_HELP: PlugHelp = { seen: false, text: null };

export function nextPlugHelp(previous: PlugHelp, set: SetDefinition, state: SimState): PlugHelp {
  if (previous.seen) {
    return previous;
  }
  const entered = enteredSpeaker(set, state);
  if (entered !== null) {
    return { seen: false, text: plugHelp(entered.plugBars) };
  }
  return { seen: previous.text !== null, text: null };
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

export function slotLabel(slot: LineupSlot): string {
  switch (slot.kind) {
    case 'phrase':
      return t('Palier {tier}, phrase {phrase}', {
        tier: formatNumber(slot.tier + 1),
        phrase: formatNumber(slot.phrase + 1),
      });
    case 'break':
      return t('Palier {tier}, break', { tier: formatNumber(slot.tier + 1) });
    case 'drop':
      return t('Palier {tier}, drop', { tier: formatNumber(slot.tier + 1) });
    case 'sunrise':
      return t('Sunrise');
  }
}

export function isNight(fraction: number): boolean {
  return fraction >= NIGHT_START && fraction < NIGHT_END;
}

// Along the reading direction: `start` is from the line-up's start, its right edge in Arabic.
export interface SlotEdges {
  start: number;
  width: number;
}

// The set fraction is the slot the sun is in plus how far through it, so the sun crosses each slot as the slot fills.
export function sunPosition(fraction: number, slots: readonly SlotEdges[]): number {
  const count = slots.length;
  if (count === 0) {
    return 0;
  }
  const at = clamp01(fraction) * count;
  const index = Math.min(Math.floor(at), count - 1);
  const slot = slots[index];
  return slot === undefined ? 0 : slot.start + (at - index) * slot.width;
}

export interface DropReading {
  label: string;
  value: string;
  dropping: boolean;
}

export function dropReading(
  set: SetDefinition,
  state: SimState,
  content: GameContent,
): DropReading {
  const tier = set.tiers[state.set.tier];
  if (state.status === 'won' || tier === undefined) {
    return { label: t('Sunrise'), value: '', dropping: false };
  }
  if (state.set.segment === 'drop') {
    const bossId = state.bosses?.at(-1);
    const boss = content.enemies.find((enemy) => enemy.id === bossId);
    return {
      label: t('Drop'),
      value: boss === undefined ? t('Le boss') : t(boss.name),
      dropping: true,
    };
  }
  return { label: t('Drop'), value: formatDuration(ticksToDrop(set, state) ?? 0), dropping: false };
}

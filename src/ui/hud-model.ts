import type {
  GameContent,
  GaugeDefinition,
  SetDefinition,
  SkillDefinition,
  TrapDefinition,
  WeaponDefinition,
} from '../data/types';
import { t } from '../shared/i18n';
import { NIGHT_END, NIGHT_START, type PaletteToken, isClassToken } from '../shared/palette';
import { setTempo, ticksToDrop } from '../sim/lineup';
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

// The notches the ring of a gauge marks: none for a gauge that fills smoothly.
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

export function playerLabel(player: Pick<PlayerState, 'id' | 'name'>): string {
  return player.name ?? defaultName(player.id);
}

export interface Roster {
  // More than one player in the sim: the HUD shows a band per player. Alone, it is the solo HUD.
  team: boolean;
  // The players of this screen, in the order of the frame.
  locals: PlayerState[];
  // The other players of the sim, remote ones, in the order of the sim.
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
}

// The kind of the trap the trap key would take back where the player stands, if a hand is free.
export function trapToTake(
  definitions: ReadonlyMap<string, Pick<TrapDefinition, 'radius'>>,
  state: Pick<SimState, 'traps'>,
  player: Pick<PlayerState, 'x' | 'y' | 'hand'>,
  handSize: number,
): string | null {
  const under = trapAt(definitions, state.traps, player);
  return under === undefined || (player.hand?.length ?? 0) >= handSize ? null : under.kind;
}

// One tile per hand slot. A held trap is available unless the field is full or a trap stands where
// it would go.
export function handTiles(
  definitions: ReadonlyMap<string, Pick<TrapDefinition, 'radius'>>,
  state: Pick<SimState, 'traps'>,
  player: Pick<PlayerState, 'x' | 'y' | 'hand'>,
  handSize: number,
  capacity: number,
): HandTile[] {
  const free =
    state.traps.length < capacity && trapAt(definitions, state.traps, player) === undefined;
  return Array.from({ length: handSize }, (_, index) => {
    const trapId = player.hand?.[index] ?? null;
    return { trapId, available: trapId !== null && free };
  });
}

const plugHelps = (): readonly string[] => [
  t('Reste zéro mesure pour brancher'),
  t('Reste une mesure pour brancher'),
  t('Reste deux mesures pour brancher'),
  t('Reste trois mesures pour brancher'),
  t('Reste quatre mesures pour brancher'),
];

export function plugHelp(bars: number): string {
  return plugHelps()[bars] ?? t('Reste {bars} mesures pour brancher', { bars: formatNumber(bars) });
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

export interface DropReading {
  label: string;
  value: string;
  dropping: boolean;
}

// The first thing the line-up says: how long until the drop, who the drop brought, or the sunrise.
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

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
import { setTempo, ticksToDrop } from '../sim/lineup';
import type { PlayerState, SimState } from '../sim/state';
import { gaugeValue } from '../sim/gauges';
import { skillCooldownTicks } from '../sim/stats';
import { trapTheKeyTakes } from '../sim/trap-moves';
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

export interface TwinVibesReading {
  left: number;
  ending: boolean;
}

// While the vibes jumelles double the vibes: the share of their bars left, and whether their last bar plays.
export function twinVibesReading(
  state: Pick<SimState, 'twinVibes'>,
  set: SetDefinition,
  ticksPerBar: number,
): TwinVibesReading | null {
  const twins = state.twinVibes;
  if (twins?.stage !== 'doubling' || set.twinVibes === undefined) {
    return null;
  }
  return {
    left: ratio(twins.ticksLeft, set.twinVibes.bars * ticksPerBar),
    ending: twins.ticksLeft <= ticksPerBar,
  };
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

// What the player holds above their head: a trap, an offering for the fire or a giant, or nothing.
export interface CarriedTile {
  trapId: string | null;
  offering?: true;
}

export function carriedTile(player: Pick<PlayerState, 'carriedTrap' | 'offering'>): CarriedTile {
  if (player.carriedTrap !== undefined) {
    return { trapId: player.carriedTrap.kind };
  }
  return player.offering === undefined ? { trapId: null } : { trapId: null, offering: true };
}

// The trap the place key would lift: with empty hands, or with room for one more above the head.
export function trapToTake(
  definitions: ReadonlyMap<string, Pick<TrapDefinition, 'radius'>>,
  state: Pick<SimState, 'traps'>,
  player: Pick<
    PlayerState,
    | 'x'
    | 'y'
    | 'radius'
    | 'aim'
    | 'carriedTrap'
    | 'carriedUnder'
    | 'laidTrapIds'
    | 'offering'
    | 'modifiers'
    | 'suppressedTicks'
    | 'boosts'
  >,
  capacity = 1,
): string | null {
  if (player.offering !== undefined) {
    return null;
  }
  return trapTheKeyTakes(definitions, state.traps, player, capacity)?.kind ?? null;
}

export function trapTileTitle(
  tile: CarriedTile,
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

export function trapCaption(
  definitions: ReadonlyMap<string, Pick<TrapDefinition, 'takeLabel' | 'putLabel'>>,
  taken: string | null,
  carried: string | null,
): string | null {
  const id = taken ?? carried;
  const trap = id === null ? undefined : definitions.get(id);
  if (trap === undefined) {
    return null;
  }
  return t(taken === null ? trap.putLabel : trap.takeLabel);
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

export function isNight(fraction: number): boolean {
  return fraction >= NIGHT_START && fraction < NIGHT_END;
}

export type SetMoment = 'buildup' | 'break' | 'drop' | 'sunrise';

// The moment of the set in one word, and the countdown to the drop while it is coming.
export interface MomentReading {
  moment: SetMoment;
  tier: string;
  word: string;
  countdown: string;
}

export function momentReading(set: SetDefinition, state: SimState): MomentReading {
  if (state.status === 'won' || set.tiers[state.set.tier] === undefined) {
    return { moment: 'sunrise', tier: '', word: t('Sunrise'), countdown: '' };
  }
  const tier = t('Palier {tier} / {count}', {
    tier: formatNumber(state.set.tier + 1),
    count: formatNumber(set.tiers.length),
  });
  const moment = state.set.segment;
  const word = { buildup: t('Montée'), break: t('Break'), drop: t('Drop') }[moment];
  const countdown = moment === 'drop' ? '' : formatDuration(ticksToDrop(set, state) ?? 0);
  return { moment, tier, word, countdown };
}

export type TierStage = 'done' | 'current' | 'dropping' | 'next';

export interface TierReading {
  stage: TierStage;
  // How far the tier has gone towards its drop.
  fill: number;
}

export function tierReadings(set: SetDefinition, state: SimState): TierReading[] {
  const { ticksPerBar, ticksPerPhrase } = setTempo(set);
  const won = state.status === 'won';
  return set.tiers.map((tier, index) => {
    if (won || index < state.set.tier) {
      return { stage: 'done', fill: 1 };
    }
    if (index > state.set.tier) {
      return { stage: 'next', fill: 0 };
    }
    if (state.set.segment === 'drop') {
      return { stage: 'dropping', fill: 1 };
    }
    const length = tier.buildupPhrases * ticksPerPhrase + tier.breakBars * ticksPerBar;
    return { stage: 'current', fill: 1 - ratio(ticksToDrop(set, state) ?? 0, length) };
  });
}

import type {
  ClassDefinition,
  GameContent,
  Rarity,
  StatKey,
  WeaponDefinition,
} from '../data/types';
import { t } from '../shared/i18n';
import { attackReach } from '../sim/attacks';
import type { PlayerState, WeaponSlot } from '../sim/state';
import { applyModifiers, skillCooldownTicks, statValue, upgradeForm } from '../sim/stats';
import { trailDismount, trailRide } from '../sim/weapons/trail-ride';
import { damageOf, propHit, rateOf } from './class-figures';
import { formatNumber, formatPercent, formatSeconds, formatTenth } from './format';
import { playerLabel } from './hud-model';
import { mostOf, pipsOf } from './programme/figures';

type Modifiers = PlayerState['modifiers'];
// A trail prop gives its speed once it lays its trail, which the slot then holds.
type Held = Pick<WeaponSlot, 'id' | 'level' | 'trail'>;

export interface StatsSteps {
  readonly start: number;
  readonly now: number;
}

export interface StatsRow {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly text: string;
  // Written small after the value and after what the previewed card would give; empty for most.
  readonly unit: string;
  // Out of five against the most any character starts with, none lit where every one starts at 0;
  // null where this character has no base.
  readonly steps: StatsSteps | null;
  // What the cards added, signed; empty when they added nothing.
  readonly gain: string;
  // The value the previewed card would give, when it changes this one.
  readonly after?: string;
}

export interface PropLine {
  readonly name: string;
  readonly level: number;
  // The damage of one hit; null for a prop that never hits.
  readonly hit: string | null;
}

export interface StatsProp extends PropLine {
  readonly id: string;
  // Its line once the previewed card is taken; a prop not held yet stands at level 0 until then.
  readonly after?: PropLine;
}

export interface StatsSpecial {
  readonly name: string;
  readonly recharge: StatsRow;
  readonly rows: readonly StatsRow[];
}

export interface StatsSheet {
  readonly classId: string;
  readonly player: string;
  readonly className: string;
  readonly rows: readonly StatsRow[];
  readonly special: StatsSpecial;
  readonly props: readonly StatsProp[];
  // A card is previewed and changes none of these lines.
  readonly unchanged: boolean;
}

export interface StatsPreview {
  readonly id: string;
  readonly rarity: Rarity;
}

interface RowSpec {
  readonly id: string;
  label(): string;
  // With these cards at this level; undefined where the class shows no such line.
  of(definition: ClassDefinition, build: Powered): number | undefined;
  // The number alone, as the gain reads it too.
  readonly digits: (value: number) => string;
  // What the number counts, when its number alone does not say it.
  unit?(): string;
}

// The cards and the level that grow a player's stats; never a boost that runs out.
interface Powered {
  readonly modifiers: Modifiers;
  // Every hit the player deals, by their level.
  readonly levelPower: number;
  // The tempo of the stage played, which a rate counts its beats in.
  readonly ticksPerBeat: number;
}

const noCard = (ticksPerBeat: number): Powered => ({ modifiers: {}, levelPower: 1, ticksPerBeat });

const read = ({ modifiers }: Powered, stat: StatKey, base: number): number =>
  statValue({ modifiers }, stat, base);

// A stat the data holds; where it holds none, only what the cards added, once they added some.
function added(base: number | undefined, extra: number): number | undefined {
  if (base !== undefined) {
    return base + extra;
  }
  return extra > 0 ? extra : undefined;
}

const ROWS: readonly RowSpec[] = [
  {
    id: 'health',
    label: () => t('Health'),
    of: (definition, build) => read(build, 'maxHpAdd', definition.maxHp),
    digits: formatNumber,
  },
  {
    id: 'speed',
    label: () => t('Speed'),
    of: (definition, build) => read(build, 'speedMul', definition.speed),
    digits: formatTenth,
  },
  {
    id: 'damage',
    label: () => t('Damage'),
    of: ({ attack }, build) => {
      const damage = damageOf(attack);
      return damage === undefined ? undefined : read(build, 'damageMul', damage) * build.levelPower;
    },
    digits: formatNumber,
  },
  {
    id: 'rate',
    label: () => t('Rate'),
    of: ({ attack }, build) => {
      const rate = rateOf(attack, build.ticksPerBeat);
      return rate === undefined ? undefined : rate / read(build, 'attackCooldownMul', 1);
    },
    digits: formatTenth,
    unit: () => t('/beat'),
  },
  {
    id: 'shots',
    label: () => t('Shots'),
    of: ({ attack }, build) =>
      added('count' in attack ? attack.count : undefined, read(build, 'projectileCountAdd', 0)),
    digits: formatNumber,
  },
  {
    id: 'pierce',
    label: () => t('Pierce'),
    of: ({ attack }, build) =>
      added('pierce' in attack ? attack.pierce : undefined, read(build, 'pierceAdd', 0)),
    digits: formatNumber,
  },
  {
    id: 'range',
    label: () => t('Range'),
    of: ({ attack }, { modifiers }) => attackReach(attack, { modifiers }),
    digits: formatNumber,
  },
  {
    id: 'pickup',
    label: () => t('Pickup'),
    of: (definition, build) => read(build, 'pickupRadiusMul', definition.pickupRadius),
    digits: formatNumber,
  },
];

function skillDamage({ skill }: ClassDefinition): number | undefined {
  return 'damage' in skill.effect ? skill.effect.damage : undefined;
}

// Damage where the special holds some, else its power against its start; radius and count once a
// card changed them, the special's most common cards.
const SPECIAL_ROWS: readonly RowSpec[] = [
  {
    id: 'damage',
    label: () => t('Damage'),
    of: (definition, build) => {
      const damage = skillDamage(definition);
      return damage === undefined
        ? undefined
        : read(build, 'skillPowerMul', damage) * build.levelPower;
    },
    digits: formatNumber,
  },
  {
    id: 'power',
    label: () => t('Power'),
    of: (definition, build) =>
      skillDamage(definition) === undefined ? read(build, 'skillPowerMul', 1) : undefined,
    digits: formatPercent,
  },
  {
    id: 'radius',
    label: () => t('Radius'),
    of: (_, build) => added(undefined, read(build, 'skillRadiusMul', 1) - 1),
    digits: formatPercent,
  },
  {
    id: 'count',
    label: () => t('Count'),
    of: (_, build) => added(undefined, read(build, 'skillCountAdd', 0)),
    digits: formatNumber,
  },
];

const RECHARGE: RowSpec = {
  id: 'recharge',
  label: () => t('Cooldown'),
  of: ({ skill }, { modifiers }) => skillCooldownTicks({ modifiers }, skill),
  digits: formatSeconds,
};

function signed(digits: (value: number) => string, value: number): string {
  const size = digits(Math.abs(value));
  if (size === digits(0)) {
    return size;
  }
  return `${value > 0 ? '+' : '-'}${size}`;
}

function rowOf(
  spec: RowSpec,
  definition: ClassDefinition,
  // The most any character starts with, for a row with steps.
  most: number | null,
  now: Powered,
  after: Powered | null,
): StatsRow | null {
  const start = spec.of(definition, noCard(now.ticksPerBeat));
  const value = spec.of(definition, now);
  const next = after === null ? undefined : spec.of(definition, after);
  if (value === undefined && next === undefined) {
    return null;
  }
  // A row with no start reads as what the cards added alone.
  const textOf = (shown: number): string =>
    start === undefined ? signed(spec.digits, shown) : spec.digits(shown);
  const shown = value ?? 0;
  const text = textOf(shown);
  const changed = next === undefined ? undefined : textOf(next);
  const gain = start === undefined ? '' : signed(spec.digits, shown - start);
  return {
    id: spec.id,
    label: spec.label(),
    value: shown,
    text,
    unit: spec.unit?.() ?? '',
    steps:
      start === undefined || most === null
        ? null
        : { start: pipsOf(start, most), now: pipsOf(shown, most) },
    gain: gain === spec.digits(0) ? '' : gain,
    ...(changed === undefined || changed === text ? {} : { after: changed }),
  };
}

const MOSTS = new WeakMap<GameContent, Map<number, readonly number[]>>();

// The most any character of the content starts with on each of the rows, which its steps fill
// against; on the stage's tempo too, so a rate's steps compare characters, never stages.
function mostsOf(content: GameContent, ticksPerBeat: number): readonly number[] {
  let byTempo = MOSTS.get(content);
  if (byTempo === undefined) {
    byTempo = new Map();
    MOSTS.set(content, byTempo);
  }
  let mosts = byTempo.get(ticksPerBeat);
  if (mosts === undefined) {
    const bare = noCard(ticksPerBeat);
    mosts = ROWS.map((spec) =>
      mostOf(content.classes.flatMap((entry) => spec.of(entry, bare) ?? [])),
    );
    byTempo.set(ticksPerBeat, mosts);
  }
  return mosts;
}

function weaponOf(content: GameContent, id: string): WeaponDefinition | undefined {
  return content.weapons?.find((weapon) => weapon.id === id);
}

// What the props would be once this prop card is taken: a fusion replaces its prop at level 1.
function heldAfter(held: readonly Held[], weapon: WeaponDefinition): readonly Held[] {
  const { evolvedFrom } = weapon;
  if (evolvedFrom !== undefined) {
    return held.map((slot) => (slot.id === evolvedFrom ? { id: weapon.id, level: 1 } : slot));
  }
  if (held.some((slot) => slot.id === weapon.id)) {
    return held.map((slot) => (slot.id === weapon.id ? { ...slot, level: slot.level + 1 } : slot));
  }
  return [...held, { id: weapon.id, level: 1 }];
}

interface Build extends Powered {
  readonly held: readonly Held[];
}

function previewed(build: Build, content: GameContent, preview: StatsPreview): Build {
  const upgrade = content.upgrades.find((entry) => entry.id === preview.id);
  if (upgrade !== undefined) {
    const modifiers = { ...build.modifiers };
    applyModifiers({ modifiers }, upgradeForm(upgrade, preview.rarity).modifiers);
    return { ...build, modifiers };
  }
  const weapon = weaponOf(content, preview.id);
  if (weapon === undefined) {
    throw new Error(`Unknown card "${preview.id}": neither an upgrade nor a weapon of the content`);
  }
  return {
    ...build,
    modifiers: ridden(build, content, weapon),
    held: heldAfter(build.held, weapon),
  };
}

// The speed a trail prop card changes, as the sim does: a fusion takes back its base's ride once
// the base laid its trail, and a trail prop not held yet gives its own once it lays its trail.
function ridden(
  { modifiers, held }: Build,
  content: GameContent,
  weapon: WeaponDefinition,
): Modifiers {
  const ride = { modifiers: { ...modifiers } };
  const base = weapon.evolvedFrom === undefined ? undefined : weaponOf(content, weapon.evolvedFrom);
  const laid = held.some((slot) => slot.id === weapon.evolvedFrom && slot.trail !== undefined);
  if (laid && base?.effect.kind === 'trail') {
    applyModifiers(ride, trailDismount(base.effect));
  }
  if (weapon.effect.kind === 'trail' && !held.some((slot) => slot.id === weapon.id)) {
    applyModifiers(ride, trailRide(weapon.effect));
  }
  return ride.modifiers;
}

function lineOf(content: GameContent, slot: Held, build: Powered): PropLine {
  const weapon = weaponOf(content, slot.id);
  if (weapon === undefined) {
    throw new Error(`Prop "${slot.id}" held but not in the content`);
  }
  const hit = propHit(weapon, slot.level, build);
  return { name: t(weapon.name), level: slot.level, hit: hit === null ? null : formatNumber(hit) };
}

const sameLine = (a: PropLine, b: PropLine): boolean =>
  a.name === b.name && a.level === b.level && a.hit === b.hit;

function propsOf(content: GameContent, now: Build, after: Build | null): StatsProp[] {
  return (after ?? now).held.map((slot, index) => {
    const held = now.held[index];
    const line =
      held === undefined
        ? { ...lineOf(content, slot, now), level: 0, hit: null }
        : lineOf(content, held, now);
    const next = after === null ? undefined : lineOf(content, slot, after);
    return {
      id: held?.id ?? slot.id,
      ...line,
      ...(next === undefined || sameLine(line, next) ? {} : { after: next }),
    };
  });
}

type SheetPlayer = Pick<
  PlayerState,
  'id' | 'name' | 'classId' | 'modifiers' | 'levelPower' | 'weapons'
>;

export function statsSheet(
  player: SheetPlayer,
  definition: ClassDefinition,
  content: GameContent,
  ticksPerBeat: number,
  preview?: StatsPreview,
): StatsSheet {
  const now: Build = {
    modifiers: player.modifiers,
    levelPower: player.levelPower ?? 1,
    ticksPerBeat,
    held: player.weapons ?? [],
  };
  const after = preview === undefined ? null : previewed(now, content, preview);
  const mosts = mostsOf(content, ticksPerBeat);
  const recharge = rowOf(RECHARGE, definition, null, now, after);
  if (recharge === null) {
    throw new Error(`The special of "${definition.id}" has no cooldown`);
  }
  const sheet = {
    classId: definition.id,
    player: playerLabel(player),
    className: t(definition.name),
    rows: ROWS.flatMap(
      (spec, index) => rowOf(spec, definition, mosts[index] ?? null, now, after) ?? [],
    ),
    special: {
      name: t(definition.skill.name),
      recharge,
      rows: SPECIAL_ROWS.flatMap((spec) => rowOf(spec, definition, null, now, after) ?? []),
    },
    props: propsOf(content, now, after),
  };
  const lit = [...sheet.rows, recharge, ...sheet.special.rows, ...sheet.props].some(
    (line) => line.after !== undefined,
  );
  return { ...sheet, unchanged: preview !== undefined && !lit };
}

// Null for a player whose class the content does not hold.
export function statsSheetOf(
  player: SheetPlayer,
  content: GameContent,
  ticksPerBeat: number,
  preview?: StatsPreview,
): StatsSheet | null {
  const definition = content.classes.find((entry) => entry.id === player.classId);
  return definition === undefined
    ? null
    : statsSheet(player, definition, content, ticksPerBeat, preview);
}

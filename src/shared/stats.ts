import { isOneOf, isRecord } from './guards';
import { type Locale, isLocale } from './languages';

export type GameMode = 'solo' | 'local' | 'online';
export type GameDevice = 'keyboardMouse' | 'gamepad' | 'touch';
export const GAME_EDITIONS = ['full', 'demo', 'steam', 'steam-demo'] as const;
export type GameEdition = (typeof GAME_EDITIONS)[number];
export type GameOutcome = 'won' | 'core' | 'downed' | 'quit' | 'interrupted';

interface GameFields {
  stage: string;
  mode: GameMode;
  players: number;
  classes: string;
  device: GameDevice;
  version: string;
  // Absent from games of releases before the game sent it.
  locale?: Locale;
}

export interface GameStart extends GameFields {
  event: 'start';
}

// A drop the game beat or died in: its bars are those the sim played, card choices and pauses aside.
export interface GameDrop {
  stage: string;
  tier: number;
  bars: number;
  bossFell: boolean;
}

export interface GameEnd extends GameFields {
  event: 'end';
  outcome: GameOutcome;
  tier: number;
  seconds: number;
  // In play order, at most `MAX_DROPS`; absent from games of releases before the game sent it.
  drops?: GameDrop[];
}

export type CrashPlace = 'loop' | 'event' | 'promise';
export type CrashName =
  | 'Error'
  | 'TypeError'
  | 'RangeError'
  | 'ReferenceError'
  | 'SyntaxError'
  | 'EvalError'
  | 'URIError'
  | 'AggregateError'
  | 'DOMException'
  | 'other';

export interface GameCrash {
  event: 'error';
  version: string;
  where: CrashPlace;
  name: CrashName;
  message: string;
  frame: string;
  // Both present while a game runs on the page, both absent otherwise.
  stage?: string;
  mode?: GameMode;
}

export type GameEvent = GameStart | GameEnd | GameCrash;

export const CRASH_NAMES: readonly CrashName[] = [
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'EvalError',
  'URIError',
  'AggregateError',
  'DOMException',
  'other',
];
export const CRASH_MESSAGE_LENGTH = 120;
export const MAX_DROPS = 64;

const START_FIELDS = ['event', 'stage', 'mode', 'players', 'classes', 'device', 'version'];
const END_FIELDS = [...START_FIELDS, 'outcome', 'tier', 'seconds'];
const DROP_FIELDS = ['stage', 'tier', 'bars', 'bossFell'];
const CRASH_FIELDS = ['event', 'version', 'where', 'name', 'message', 'frame'];
const CRASH_PLACES: readonly CrashPlace[] = ['loop', 'event', 'promise'];
const MODES: readonly GameMode[] = ['solo', 'local', 'online'];
const DEVICES: readonly GameDevice[] = ['keyboardMouse', 'gamepad', 'touch'];
const OUTCOMES: readonly GameOutcome[] = ['won', 'core', 'downed', 'quit', 'interrupted'];
const ID = /^[a-z0-9-]{1,24}$/;
const VERSION = /^[a-z0-9.-]{1,40}$/;
const DIGITS = /^\d{1,9}$/;
const MAX_PLAYERS = 4;
// A quote would carry text the game did not write: the game scrubs them, the Worker checks it did.
const CRASH_MESSAGE = new RegExp(`^[^"\`«»“”\\p{Cc}]{0,${String(CRASH_MESSAGE_LENGTH)}}$`, 'u');
const CRASH_FRAME = /^(?:[\w.-]{1,80}:\d{1,7}:\d{1,7})?$/;

export function parseGameEvent(json: string): GameEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
  if (!isRecord(value)) return null;
  if (value.event === 'error') return parseGameCrash(value);
  const end = value.event === 'end';
  if (!hasExactly(value, end ? END_FIELDS : START_FIELDS, end ? ['locale', 'drops'] : ['locale'])) {
    return null;
  }
  const { event, stage, mode, players, classes, device, version, locale } = value;
  if ('locale' in value && !isLocale(locale)) return null;
  const valid =
    isId(stage) &&
    isOneOf(mode, MODES) &&
    isCount(players, 1, MAX_PLAYERS) &&
    typeof classes === 'string' &&
    classes.split('+').length === players &&
    classes.split('+').every(isId) &&
    isOneOf(device, DEVICES) &&
    isVersion(version);
  if (!valid) return null;
  const game = {
    stage,
    mode,
    players,
    classes,
    device,
    version,
    ...(isLocale(locale) ? { locale } : {}),
  };
  if (event === 'start') return { event, ...game };
  const { outcome, tier, seconds, drops } = value;
  const ends =
    event === 'end' &&
    isOneOf(outcome, OUTCOMES) &&
    isCount(tier, 0, Infinity) &&
    isCount(seconds, 0, Infinity);
  if (!ends) return null;
  const ended: GameEnd = { event, ...game, outcome, tier, seconds };
  if (!('drops' in value)) return ended;
  return isDrops(drops) ? { ...ended, drops } : null;
}

function isDrops(value: unknown): value is GameDrop[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_DROPS &&
    value.every((drop) => isRecord(drop) && hasExactly(drop, DROP_FIELDS, []) && isDrop(drop))
  );
}

function isDrop(drop: Record<string, unknown>): drop is Record<string, unknown> & GameDrop {
  return (
    isId(drop.stage) &&
    isCount(drop.tier, 0, Infinity) &&
    isCount(drop.bars, 1, Infinity) &&
    typeof drop.bossFell === 'boolean'
  );
}

// One column of the stats dataset: `stage:tier:bars:fell` for each drop, apart by a space, which
// an id never holds.
export function dropsBlob(drops: readonly GameDrop[]): string {
  return drops
    .map(({ stage, tier, bars, bossFell }) =>
      [stage, String(tier), String(bars), bossFell ? '1' : '0'].join(':'),
    )
    .join(' ');
}

// The drops of a blob the Worker wrote; an entry it could not have written is left out.
export function parseDropsBlob(blob: string): GameDrop[] {
  return blob.split(' ').flatMap((entry) => {
    const [stage, tier, bars, fell, ...rest] = entry.split(':');
    const drop = { stage, tier: whole(tier), bars: whole(bars), bossFell: fell === '1' };
    return rest.length === 0 && (fell === '0' || fell === '1') && isDrop(drop) ? [drop] : [];
  });
}

function whole(text: string | undefined): number {
  return text !== undefined && DIGITS.test(text) ? Number(text) : NaN;
}

function parseGameCrash(value: Record<string, unknown>): GameCrash | null {
  if (!hasExactly(value, CRASH_FIELDS, ['stage', 'mode'])) return null;
  const { version, where, name, message, frame, stage, mode } = value;
  const valid =
    isVersion(version) &&
    isOneOf(where, CRASH_PLACES) &&
    isOneOf(name, CRASH_NAMES) &&
    typeof message === 'string' &&
    CRASH_MESSAGE.test(message) &&
    typeof frame === 'string' &&
    CRASH_FRAME.test(frame);
  if (!valid) return null;
  const crash: GameCrash = { event: 'error', version, where, name, message, frame };
  if (isId(stage) && isOneOf(mode, MODES)) return { ...crash, stage, mode };
  return 'stage' in value || 'mode' in value ? null : crash;
}

function hasExactly(
  value: Record<string, unknown>,
  fields: readonly string[],
  optional: readonly string[],
): boolean {
  const keys = Object.keys(value).filter((key) => !optional.includes(key));
  return keys.length === fields.length && keys.every((key) => fields.includes(key));
}

function isVersion(value: unknown): value is string {
  return typeof value === 'string' && VERSION.test(value);
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && ID.test(value);
}

function isCount(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

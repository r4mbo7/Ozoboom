import { isOneOf, isRecord } from './guards';
import { type Locale, isLocale } from './languages';

export type GameMode = 'solo' | 'local' | 'online';
export type GameDevice = 'keyboardMouse' | 'gamepad' | 'touch';
export type GameEdition = 'demo' | 'full';
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

export interface GameEnd extends GameFields {
  event: 'end';
  outcome: GameOutcome;
  tier: number;
  seconds: number;
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

const START_FIELDS = ['event', 'stage', 'mode', 'players', 'classes', 'device', 'version'];
const END_FIELDS = [...START_FIELDS, 'outcome', 'tier', 'seconds'];
const CRASH_FIELDS = ['event', 'version', 'where', 'name', 'message', 'frame'];
const CRASH_PLACES: readonly CrashPlace[] = ['loop', 'event', 'promise'];
const MODES: readonly GameMode[] = ['solo', 'local', 'online'];
const DEVICES: readonly GameDevice[] = ['keyboardMouse', 'gamepad', 'touch'];
const OUTCOMES: readonly GameOutcome[] = ['won', 'core', 'downed', 'quit', 'interrupted'];
const ID = /^[a-z0-9-]{1,24}$/;
const VERSION = /^[a-z0-9.-]{1,40}$/;
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
  if (!hasExactly(value, value.event === 'end' ? END_FIELDS : START_FIELDS, ['locale'])) {
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
  const { outcome, tier, seconds } = value;
  return event === 'end' &&
    isOneOf(outcome, OUTCOMES) &&
    isCount(tier, 0, Infinity) &&
    isCount(seconds, 0, Infinity)
    ? { event, ...game, outcome, tier, seconds }
    : null;
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

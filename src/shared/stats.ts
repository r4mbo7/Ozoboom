import { type Locale, isLocale } from './languages';

export type GameMode = 'solo' | 'local' | 'online';
export type GameDevice = 'keyboardMouse' | 'gamepad' | 'touch';
// The site a game was played on: the public demo or the full game.
export type GameEdition = 'demo' | 'full';
export type GameOutcome = 'won' | 'core' | 'downed' | 'quit' | 'interrupted';

interface GameFields {
  stage: string;
  mode: GameMode;
  players: number;
  classes: string;
  device: GameDevice;
  version: string;
  // Absent from the games of the releases before the game sent it.
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

export type GameEvent = GameStart | GameEnd;

const START_FIELDS = ['event', 'stage', 'mode', 'players', 'classes', 'device', 'version'];
const END_FIELDS = [...START_FIELDS, 'outcome', 'tier', 'seconds'];
const MODES: readonly unknown[] = ['solo', 'local', 'online'] satisfies GameMode[];
const DEVICES: readonly unknown[] = ['keyboardMouse', 'gamepad', 'touch'] satisfies GameDevice[];
const OUTCOMES: readonly unknown[] = [
  'won',
  'core',
  'downed',
  'quit',
  'interrupted',
] satisfies GameOutcome[];
const ID = /^[a-z0-9-]{1,24}$/;
const VERSION = /^[a-z0-9.-]{1,40}$/;
const MAX_PLAYERS = 4;

export function parseGameEvent(json: string): GameEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  const fields = event.event === 'end' ? END_FIELDS : START_FIELDS;
  const keys = Object.keys(event).filter((key) => key !== 'locale');
  if (keys.length !== fields.length || !keys.every((k) => fields.includes(k))) return null;
  if ('locale' in event && !isLocale(event.locale)) return null;
  const { stage, mode, players, classes, device, version } = event;
  const valid =
    isId(stage) &&
    MODES.includes(mode) &&
    isCount(players, 1, MAX_PLAYERS) &&
    typeof classes === 'string' &&
    classes.split('+').length === players &&
    classes.split('+').every(isId) &&
    DEVICES.includes(device) &&
    typeof version === 'string' &&
    VERSION.test(version) &&
    (event.event === 'start' ||
      (event.event === 'end' &&
        OUTCOMES.includes(event.outcome) &&
        isCount(event.tier, 0, Infinity) &&
        isCount(event.seconds, 0, Infinity)));
  return valid ? (event as unknown as GameEvent) : null;
}

function isId(value: unknown): boolean {
  return typeof value === 'string' && ID.test(value);
}

function isCount(value: unknown, min: number, max: number): boolean {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

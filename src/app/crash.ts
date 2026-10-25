import { isOneOf, isRecord } from '../shared/guards';
import {
  CRASH_MESSAGE_LENGTH,
  CRASH_NAMES,
  type CrashPlace,
  type GameCrash,
  type GameMode,
} from '../shared/stats';

export interface CrashScene {
  readonly stage: string;
  readonly mode: GameMode;
}

export interface CrashReporting {
  readonly version: string;
  // Origin of the page: a stack frame from elsewhere (an extension, another site) is not the game's.
  readonly origin: string;
  readonly scene: () => CrashScene | null;
  readonly send: (crash: GameCrash) => void;
}

export type CrashReport = (thrown: unknown, where: CrashPlace) => void;

type CrashSignature = Pick<GameCrash, 'name' | 'message' | 'frame'>;

// The quota of the free plan is shared with the game counts and the TURN Worker.
const CRASHES_PER_PAGE = 3;
const PAIRED_QUOTES =
  /"[^"]*"|`[^`]*`|«[^»]*»|“[^”]*”|(?<![\p{L}\p{N}])['‘][^'’]*['’](?![\p{L}\p{N}])/gu;
const LONE_QUOTE = /["`«»“”]|(?<![\p{L}\p{N}])['‘]/u;
const STACK_LOCATION = /([^\s(@]+):(\d+):(\d+)\)?$/;
const FILE = /^[\w.-]{1,80}$/;

export function createCrashReport({ version, origin, scene, send }: CrashReporting): CrashReport {
  const reported = new Set<string>();
  return (thrown, where) => {
    const signature = signatureOf(thrown, origin);
    const key = JSON.stringify(signature);
    if (reported.has(key) || reported.size === CRASHES_PER_PAGE) {
      return;
    }
    reported.add(key);
    send({ event: 'error', version, where, ...signature, ...scene() });
  };
}

function signatureOf(thrown: unknown, origin: string): CrashSignature {
  if (!isRecord(thrown)) {
    return { name: 'other', message: '', frame: '' };
  }
  const { constructor: maker, message, stack } = thrown;
  const name = typeof maker === 'function' ? maker.name : '';
  return {
    name: isOneOf(name, CRASH_NAMES) ? name : 'other',
    message: typeof message === 'string' ? scrubbed(message) : '',
    frame: typeof stack === 'string' ? gameFrame(stack, origin) : '',
  };
}

// Whatever a player typed reaches a message only between quotes: each quoted text becomes "…".
function scrubbed(message: string): string {
  const paired = message
    .replace(/\s+/g, ' ')
    .replace(/\p{Cc}/gu, '')
    .trim()
    .replace(PAIRED_QUOTES, '…');
  const lone = paired.search(LONE_QUOTE);
  const kept = lone === -1 ? paired : `${paired.slice(0, lone)}…`;
  return kept.length > CRASH_MESSAGE_LENGTH ? `${kept.slice(0, CRASH_MESSAGE_LENGTH - 1)}…` : kept;
}

function gameFrame(stack: string, origin: string): string {
  for (const line of stack.split('\n')) {
    const location = STACK_LOCATION.exec(line.trim());
    if (location === null) {
      continue;
    }
    const [, url = '', row = '', column = ''] = location;
    const file = url.slice(url.lastIndexOf('/') + 1).split(/[?#]/)[0] ?? '';
    if (url.startsWith(`${origin}/`) && FILE.test(file)) {
      return `${file}:${row}:${column}`;
    }
  }
  return '';
}

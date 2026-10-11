import type { InputDevice } from '../input/intents';
import type { GameEvent, GameMode, GameOutcome } from '../shared/stats';
import { TICK_RATE_HZ } from '../shared/tempo';
import type { SimState } from '../sim/state';

export interface GameContext {
  readonly mode: GameMode;
  readonly device: InputDevice;
  readonly version: string;
}

export interface GameStats {
  start(state: SimState, context: GameContext): void;
  end(state: SimState, outcome: GameOutcome): void;
}

export function gameEvent(
  state: SimState,
  { mode, device, version }: GameContext,
  outcome?: GameOutcome,
): GameEvent {
  const fields = {
    stage: state.setId,
    mode,
    players: state.players.length,
    classes: state.players
      .map((player) => player.classId)
      .sort()
      .join('+'),
    device: device === 'none' ? 'keyboardMouse' : device,
    version,
  } as const;
  if (outcome === undefined) {
    return { event: 'start', ...fields };
  }
  return {
    event: 'end',
    ...fields,
    outcome,
    tier: state.set.tier,
    seconds: Math.floor(state.tick / TICK_RATE_HZ),
  };
}

export function outcomeOf(state: SimState): GameOutcome {
  if (state.status === 'won') {
    return 'won';
  }
  return state.core.hp <= 0 ? 'core' : 'downed';
}

export function createGameStats(send: (event: GameEvent) => void): GameStats {
  let started: GameContext | null = null;
  return {
    start(state, context) {
      started = context;
      send(gameEvent(state, context));
    },
    end(state, outcome) {
      if (started === null) {
        return;
      }
      send(gameEvent(state, started, outcome));
      started = null;
    },
  };
}

export function sendGameEvent(
  event: GameEvent,
  url: string | undefined,
  search: string,
  beacon: (url: string, data: string) => boolean,
): boolean {
  if (url === undefined || url === '' || new URLSearchParams(search).has('dev')) {
    return false;
  }
  try {
    return beacon(`${url}/event`, JSON.stringify(event));
  } catch {
    return false;
  }
}

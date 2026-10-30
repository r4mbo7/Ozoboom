import type { CommandSource } from '../net/types';
import { readSlot } from '../net/wire';
import { finite, flag, integer, list, oneOf, record, text } from '../shared/readers';
import { EMOTES, type PlayerAction, type PlayerCommand } from '../sim/commands';
import type { PlayerSlot } from '../sim/initial-state';
import { hashState } from '../sim/replay';
import { PLAYER_IDS, type SimState } from '../sim/state';

export const RECORDING_FORMAT = 1;

// A game as it was played: what started it, and the commands that entered the sim at each step.
export interface Recording {
  readonly format: typeof RECORDING_FORMAT;
  // Another version may play the same commands differently.
  readonly version: string;
  // The URL query of the game: its dev mode shapes the content and the opening scene.
  readonly query: string;
  readonly trackId: string;
  readonly seed: number;
  // The stage the game started on.
  readonly setId: string;
  readonly endless: boolean;
  readonly festival: boolean;
  readonly players: readonly PlayerSlot[];
  // `hashState` after the last step.
  readonly hash: string;
  // Every step, those that wait on an upgrade choice included: the replay holds the choice as long.
  readonly steps: readonly (readonly PlayerCommand[])[];
}

export type RecordedGame = Omit<Recording, 'format' | 'trackId' | 'hash' | 'steps'>;

export class RecordingError extends Error {}

export interface Recorder {
  readonly source: CommandSource;
  // The game up to its last step, as the text of a recording.
  save(state: SimState, trackId: string): string;
}

export function createRecorder(source: CommandSource, game: RecordedGame): Recorder {
  const steps: string[] = [];
  return {
    source: {
      next(local) {
        const commands = source.next(local);
        if (commands === null) {
          return null;
        }
        steps.push(JSON.stringify(commands));
        return commands;
      },
      stepped(state) {
        source.stepped(state);
      },
      get pending() {
        return source.pending;
      },
      close() {
        source.close();
      },
    },
    save(state, trackId) {
      return recordingText(game, trackId, hashState(state), steps);
    },
  };
}

// A recording as text: its head on the first line, then each step, as JSON, on a line of its own.
export function recordingText(
  game: RecordedGame,
  trackId: string,
  hash: string,
  steps: readonly string[],
): string {
  const head = JSON.stringify({ format: RECORDING_FORMAT, ...game, trackId, hash });
  return `${head.slice(0, -1)},"steps":[\n${steps.join(',\n')}\n]}\n`;
}

// Plays the recorded steps one by one, then waits; `ended` hears the state after the last one.
export function createReplaySource(
  steps: Recording['steps'],
  ended: (state: SimState) => void,
): CommandSource {
  let played = 0;
  return {
    next: () => steps[played] ?? null,
    stepped(state) {
      played += 1;
      if (played === steps.length) {
        ended(state);
      }
    },
    get pending() {
      return steps.length - played;
    },
    close: () => undefined,
  };
}

export function parseRecording(json: string): Recording {
  try {
    const recording = record(JSON.parse(json));
    if (recording.format !== RECORDING_FORMAT) {
      throw new RecordingError(`Not a recording of format ${String(RECORDING_FORMAT)}`);
    }
    const steps = list(recording.steps, (step) => list(step, readCommand));
    // The replay ends on its last step: without one, it would wait forever.
    if (steps.length === 0) {
      throw new RecordingError('A recording without any step');
    }
    return {
      format: RECORDING_FORMAT,
      version: text(recording.version),
      query: text(recording.query),
      trackId: text(recording.trackId),
      seed: integer(recording.seed),
      setId: text(recording.setId),
      endless: flag(recording.endless),
      festival: flag(recording.festival),
      players: list(recording.players, readSlot),
      hash: text(recording.hash),
      steps,
    };
  } catch (error) {
    if (error instanceof RecordingError) {
      throw error;
    }
    if (error instanceof SyntaxError || error instanceof TypeError || error instanceof RangeError) {
      throw new RecordingError(`Not a recording: ${error.message}`);
    }
    throw error;
  }
}

function readCommand(value: unknown): PlayerCommand {
  const command = record(value);
  const input = record(command.input);
  return {
    playerId: oneOf(command.playerId, PLAYER_IDS),
    input: {
      move: readVector(input.move),
      aim: readVector(input.aim),
      fire: flag(input.fire),
      ...(input.fireTicks === undefined ? {} : { fireTicks: finite(input.fireTicks) }),
      skill: flag(input.skill),
    },
    actions: list(command.actions, readAction),
  };
}

function readVector(value: unknown): { x: number; y: number } {
  const vector = record(value);
  return { x: finite(vector.x), y: finite(vector.y) };
}

function readAction(value: unknown): PlayerAction {
  const action = record(value);
  switch (action.type) {
    case 'placeTrap':
      return {
        type: 'placeTrap',
        trapId: text(action.trapId),
        x: finite(action.x),
        y: finite(action.y),
        dx: finite(action.dx),
        dy: finite(action.dy),
      };
    case 'takeTrap':
      return { type: 'takeTrap', x: finite(action.x), y: finite(action.y) };
    case 'chooseUpgrade':
      return { type: 'chooseUpgrade', upgradeId: text(action.upgradeId) };
    case 'emote':
      return { type: 'emote', emote: oneOf(action.emote, EMOTES) };
    case 'dash':
    case 'leave':
      return { type: action.type };
    default:
      throw new TypeError(`unknown action ${String(action.type)}`);
  }
}

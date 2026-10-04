import type { GameContent } from '../data/types';
import type { PlayerCommand } from './commands';
import { lookup, resolveContent } from './content';
import { createInitialState, type PlayerSlot } from './initial-state';
import type { GameStatus, PlayerId, SimState } from './state';
import { beginStep } from './systems/begin-step';
import { coreWatts } from './systems/core-watts';
import { playerMovement } from './systems/player-movement';
import { setProgress } from './systems/set-progress';
import { status } from './systems/status';
import { tempo } from './systems/tempo';
import type { StepContext, System } from './systems/types';

export interface SimulationOptions {
  seed: number;
  players: readonly PlayerSlot[];
  setId: string;
  content: GameContent;
}

export interface Simulation {
  readonly state: SimState;
  step(commands: readonly PlayerCommand[]): void;
}

const PIPELINES: Readonly<Record<GameStatus, readonly System[]>> = {
  running: [
    beginStep,
    tempo,
    setProgress,
    // upgrade-choice (#3)
    playerMovement,
    // player-attack (#2)
    // skills (#3)
    // spawning (#2)
    // enemy-steering (#2)
    // projectiles (#2)
    // traps (#3)
    // enemy-attacks (#2)
    // deaths (#2)
    // pickups (#2)
    // progression (#3)
    coreWatts,
    status,
  ],
  choosingUpgrade: [
    beginStep,
    // upgrade-choice (#3)
    status,
  ],
  won: [beginStep],
  lost: [beginStep],
};

export function createSimulation(options: SimulationOptions): Simulation {
  const content = resolveContent(options.content);
  const set = lookup(content.sets, options.setId, 'set');
  const state = createInitialState(options.seed, options.players, content, set);
  const commands = new Map<PlayerId, PlayerCommand>();
  const ctx: StepContext = { state, content, set, commands };

  tempo(ctx);
  state.events.push({ type: 'segment', segment: state.set.segment, tier: state.set.tier });

  return {
    state,
    step(stepCommands) {
      commands.clear();
      for (const command of stepCommands) {
        if (!state.players.some((player) => player.id === command.playerId)) {
          throw new Error(`command for unknown player ${String(command.playerId)}`);
        }
        if (commands.has(command.playerId)) {
          throw new Error(`two commands for player ${String(command.playerId)} in one step`);
        }
        commands.set(command.playerId, command);
      }
      for (const system of PIPELINES[state.status]) {
        system(ctx);
      }
    },
  };
}

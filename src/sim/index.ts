import type { GameContent } from '../data/types';
import type { PlayerCommand } from './commands';
import { lookup, resolveContent } from './content';
import { createInitialState, type PlayerSlot } from './initial-state';
import { SpatialHash } from './spatial-hash';
import type { GameStatus, PlayerId, SimState } from './state';
import { beginStep } from './systems/begin-step';
import { bystanders } from './systems/bystanders';
import { deaths } from './systems/deaths';
import { enemyAttacks } from './systems/enemy-attacks';
import { enemySteering } from './systems/enemy-steering';
import { lootCarriers, loots } from './systems/loot';
import { pickups } from './systems/pickups';
import { placedTotems, placedZones } from './systems/placed';
import { playerAttack } from './systems/player-attack';
import { playerMovement } from './systems/player-movement';
import { progression } from './systems/progression';
import { projectiles } from './systems/projectiles';
import { revive } from './systems/revive';
import { setProgress } from './systems/set-progress';
import { skills } from './systems/skills';
import { speakers } from './systems/speakers';
import { spawning } from './systems/spawning';
import { specials } from './systems/specials';
import { status } from './systems/status';
import { tempo } from './systems/tempo';
import { traps } from './systems/traps';
import { upgradeChoice } from './systems/upgrade-choice';
import { weapons } from './systems/weapons';
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

const ENEMY_GRID_CELL_SIZE = 64;

const PIPELINES: Readonly<Record<GameStatus, readonly System[]>> = {
  running: [
    beginStep,
    tempo,
    setProgress,
    upgradeChoice,
    playerMovement,
    revive,
    playerAttack,
    weapons,
    placedZones,
    skills,
    spawning,
    lootCarriers,
    enemySteering,
    placedTotems,
    specials,
    bystanders,
    projectiles,
    traps,
    speakers,
    enemyAttacks,
    deaths,
    pickups,
    loots,
    progression,
    status,
  ],
  choosingUpgrade: [beginStep, upgradeChoice, status],
  won: [beginStep],
  lost: [beginStep],
};

export function createSimulation(options: SimulationOptions): Simulation {
  const content = resolveContent(options.content);
  const set = lookup(content.sets, options.setId, 'set');
  const state = createInitialState(options.seed, options.players, content, set);
  const commands = new Map<PlayerId, PlayerCommand>();
  const enemyGrid = new SpatialHash(set.arena.width, set.arena.height, ENEMY_GRID_CELL_SIZE);
  const ctx: StepContext = { state, content, set, commands, enemyGrid };

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

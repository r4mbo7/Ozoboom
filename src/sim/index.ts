import type { GameContent } from '../data/types';
import type { PlayerCommand } from './commands';
import { lookup, resolveContent } from './content';
import { enemyStatuses } from './enemy-status';
import { setBindings } from './enter-set';
import { createInitialState, type PlayerSlot } from './initial-state';
import { FULL_MODES, FULL_STEPS } from './full';
import type { GameMode } from './mode';
import { playerBoosts } from './player-boosts';
import { recruits } from './recruits';
import type { GameStatus, PlayerId, SimState } from './state';
import { beginStep } from './systems/begin-step';
import { bombCarriers, bombs } from './systems/bomb';
import { bystanders } from './systems/bystanders';
import { dashes } from './systems/dashes';
import { emotes } from './systems/emotes';
import { deaths } from './systems/deaths';
import { departures } from './systems/departures';
import { enemyAttacks } from './systems/enemy-attacks';
import { enemySteering } from './systems/enemy-steering';
import { gauges } from './systems/gauges';
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
import { vibeRain } from './systems/vibe-rain';
import { spawning } from './systems/spawning';
import { specials } from './systems/specials';
import { status } from './systems/status';
import { tempo } from './systems/tempo';
import { traps } from './systems/traps';
import { upgradeChoice } from './systems/upgrade-choice';
import { weapons } from './systems/weapons';
import type { StepContext, System } from './systems/types';
import { gusts } from './gusts';
import { puddles } from './puddles';
import { rings } from './rings';
import { walls } from './walls';
import { zones } from './zones';

export interface SimulationOptions {
  seed: number;
  players: readonly PlayerSlot[];
  setId: string;
  content: GameContent;
  // The last boss down, its tier starts over instead of winning the game.
  endless?: boolean;
  // Plays every stage of the festival in one game, from `setId` (ADR 0018).
  festival?: boolean;
}

export interface Simulation {
  readonly state: SimState;
  step(commands: readonly PlayerCommand[]): void;
}

const RUNNING: readonly System[] = [
  beginStep,
  departures,
  tempo,
  setProgress,
  upgradeChoice,
  emotes,
  dashes,
  gusts,
  playerMovement,
  ...(FULL_STEPS.afterMovement ?? []),
  revive,
  playerAttack,
  weapons,
  placedZones,
  skills,
  spawning,
  ...(FULL_STEPS.afterSpawning ?? []),
  lootCarriers,
  bombCarriers,
  enemySteering,
  placedTotems,
  specials,
  bystanders,
  projectiles,
  puddles,
  traps,
  zones,
  speakers,
  vibeRain,
  recruits,
  walls,
  enemyAttacks,
  enemyStatuses,
  bombs,
  rings,
  deaths,
  gauges,
  pickups,
  loots,
  playerBoosts,
  progression,
];

function pipelines(mode: GameMode | undefined): Readonly<Record<GameStatus, readonly System[]>> {
  return {
    running: [...RUNNING, ...(mode?.systems ?? []), status],
    choosingUpgrade: [beginStep, departures, upgradeChoice, status],
    won: [beginStep],
    lost: [beginStep],
  };
}

function modeOf(options: SimulationOptions): GameMode | undefined {
  if (options.festival !== true) {
    return undefined;
  }
  if (FULL_MODES.festival === undefined) {
    throw new Error('this build has no Full festival');
  }
  return FULL_MODES.festival;
}

// `mode` is the options' own, but a test may play a set through one of its own.
export function createSimulation(
  options: SimulationOptions,
  mode: GameMode | undefined = modeOf(options),
): Simulation {
  const content = resolveContent(options.content);
  const set = lookup(content.sets, options.setId, 'set');
  const state = createInitialState(
    options.seed,
    options.players,
    content,
    set,
    options.endless === true,
  );
  const commands = new Map<PlayerId, PlayerCommand>();
  const ctx: StepContext = { state, content, commands, mode, ...setBindings(set, content, 0) };
  const steps = pipelines(mode);

  tempo(ctx);
  state.events.push({ type: 'segment', segment: state.set.segment, tier: state.set.tier });
  mode?.start?.(ctx);

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
      for (const system of steps[state.status]) {
        system(ctx);
      }
    },
  };
}

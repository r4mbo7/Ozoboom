import type { GameContent, SetDefinition } from '../data/types';
import { IDLE_INPUT, type PlayerCommand, type PlayerInput } from './commands';
import type { Simulation, SimulationOptions } from './index';
import type { PlayerId, SimEvent, SimState } from './state';

export function commandFor(playerId: PlayerId, input: Partial<PlayerInput> = {}): PlayerCommand {
  return { playerId, input: { ...IDLE_INPUT, ...input }, actions: [] };
}

export interface TimedEvent {
  tick: number;
  event: SimEvent;
}

export function eventsOf(state: SimState): TimedEvent[] {
  return state.events.map((event) => ({ tick: state.tick, event }));
}

export function stepAndRecord(simulation: Simulation, steps: number): TimedEvent[] {
  const recorded: TimedEvent[] = [];
  for (let i = 0; i < steps; i++) {
    simulation.step([]);
    recorded.push(...eventsOf(simulation.state));
  }
  return recorded;
}

export const FIXTURE_SET: SetDefinition = {
  id: 'fixture-set',
  name: 'Set de test',
  bpm: 145,
  arena: { width: 1600, height: 900 },
  core: { radius: 48, maxHp: 1000, wattsPerBar: 5 },
  startingWatts: 50,
  maxTraps: 6,
  levelCurve: { baseVibes: 10, vibesPerLevel: 5 },
  tiers: [
    {
      buildupPhrases: 1,
      breakBars: 2,
      bossId: 'curfew',
      spawns: [{ enemyId: 'grump', everyBars: 1, count: 2, fromPhrase: 0 }],
    },
    {
      buildupPhrases: 1,
      breakBars: 2,
      bossId: 'curfew',
      spawns: [{ enemyId: 'grump', everyBars: 1, count: 4, fromPhrase: 1 }],
    },
  ],
};

export const FIXTURE_CONTENT: GameContent = {
  classes: [
    {
      id: 'raver',
      name: 'Raveuse',
      role: 'Tire à distance',
      color: 'uv-magenta',
      maxHp: 100,
      speed: 4,
      radius: 14,
      pickupRadius: 60,
      attack: {
        damage: 10,
        cooldownTicks: 12,
        projectileSpeed: 12,
        projectileRadius: 4,
        rangeTicks: 40,
        pierce: 0,
        count: 1,
        spreadRadians: 0,
      },
      skill: {
        id: 'raver-nova',
        name: 'Nova',
        description: 'Une onde autour de soi.',
        cooldownTicks: 240,
        effect: { kind: 'nova', damage: 30, radius: 120, knockback: 20 },
      },
      ultimate: {
        id: 'raver-laser-show',
        name: 'Laser show',
        description: 'Des lasers balaient la piste.',
        cooldownTicks: 0,
        effect: { kind: 'laserShow', damagePerTick: 2, radius: 300, durationTicks: 96 },
      },
    },
  ],
  enemies: [
    {
      id: 'grump',
      name: 'Relou',
      behaviour: 'rusher',
      maxHp: 20,
      speed: 2.5,
      radius: 12,
      damage: 5,
      attackCooldownTicks: 24,
      aggroRadius: 120,
      vibesDrop: 1,
      wattsDrop: 0,
      scalingPerPhrase: { hp: 0.1, speed: 0.02 },
    },
    {
      id: 'curfew',
      name: 'Couvre-feu',
      behaviour: 'boss',
      maxHp: 500,
      speed: 1,
      radius: 40,
      damage: 30,
      attackCooldownTicks: 48,
      aggroRadius: 200,
      vibesDrop: 20,
      wattsDrop: 25,
      scalingPerPhrase: { hp: 0.2, speed: 0 },
    },
  ],
  traps: [
    {
      id: 'subwoofer',
      name: 'Caisson de basse',
      description: 'Une onde de choc sur chaque temps.',
      cost: 30,
      radius: 24,
      hp: 100,
      cadence: 'beat',
      effect: { kind: 'shockwave', damage: 8, radius: 90, knockback: 12 },
      maxLevel: 3,
      levelMul: 1.5,
    },
  ],
  upgrades: [
    {
      id: 'quick-feet',
      name: 'Pieds légers',
      description: 'Plus rapide.',
      family: 'generic',
      modifiers: [{ stat: 'speedMul', mul: 1.15 }],
      maxStacks: 3,
    },
    {
      id: 'big-bass',
      name: 'Grosse basse',
      description: 'Pièges plus forts.',
      family: 'defense',
      modifiers: [{ stat: 'trapDamageMul', mul: 1.25 }],
      maxStacks: 3,
    },
    {
      id: 'wide-nova',
      name: 'Nova large',
      description: 'Compétence plus puissante.',
      family: 'class',
      classId: 'raver',
      modifiers: [{ stat: 'skillPowerMul', mul: 1.3 }],
      maxStacks: 2,
    },
  ],
  sets: [FIXTURE_SET],
};

export const FIXTURE_OPTIONS: SimulationOptions = {
  seed: 1,
  players: [{ id: 0, classId: 'raver' }],
  setId: 'fixture-set',
  content: FIXTURE_CONTENT,
};

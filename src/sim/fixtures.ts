import type {
  BystanderDefinition,
  ClassDefinition,
  EnemyDefinition,
  GameContent,
  SetDefinition,
  TrapDefinition,
} from '../data/types';
import { TICKS_PER_BAR } from '../shared/tempo';
import { IDLE_INPUT, type PlayerAction, type PlayerCommand, type PlayerInput } from './commands';
import type { Simulation, SimulationOptions } from './index';
import type { EnemyState, PlayerId, SimEvent, SimState } from './state';
import { spawnEnemy } from './systems/spawning';

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
  core: { radius: 48, maxHp: 1000 },
  handSize: 2,
  startingHand: ['subwoofer', 'subwoofer'],
  maxTraps: 6,
  levelCurve: { baseVibes: 10, vibesPerLevel: 5 },
  pickups: { lifetimeTicks: 8 * TICKS_PER_BAR, speed: 12 },
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
      scalingPerPhrase: { hp: 1.1, speed: 1.02 },
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
      scalingPerPhrase: { hp: 1.2, speed: 1 },
    },
  ],
  traps: [
    {
      id: 'subwoofer',
      name: 'Caisson de basse',
      description: 'Une onde de choc sur chaque temps.',
      radius: 24,
      hp: 100,
      cadence: 'beat',
      effect: { kind: 'shockwave', damage: 8, radius: 90, knockback: 12 },
      lootWeight: 3,
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

const trap = (
  id: string,
  cadence: TrapDefinition['cadence'],
  effect: TrapDefinition['effect'],
): TrapDefinition => ({
  id,
  name: id,
  description: id,
  radius: 16,
  hp: 50,
  cadence,
  effect,
  lootWeight: 1,
});

const [raver] = FIXTURE_CONTENT.classes;
if (raver === undefined) {
  throw new Error('expected the raver class');
}

export const FIXTURE_CARER: ClassDefinition = {
  ...raver,
  id: 'carer',
  skill: {
    id: 'carer-pulse',
    name: 'Pulsation',
    description: 'Soigne autour de soi.',
    cooldownTicks: 192,
    effect: { kind: 'healPulse', amount: 30, radius: 150, coreRepair: 50 },
  },
};

export const FIXTURE_MIST: TrapDefinition = trap('mister', 'continuous', {
  kind: 'mist',
  slowFactor: 0.5,
  healPerBar: 10,
  radius: 80,
});

export const FIXTURE_BOUNCER: EnemyDefinition = {
  id: 'bouncer',
  name: 'Videur',
  behaviour: 'heavy',
  maxHp: 200,
  speed: 1,
  radius: 20,
  damage: 15,
  attackCooldownTicks: 36,
  aggroRadius: 100,
  vibesDrop: 5,
  scalingPerPhrase: { hp: 1.1, speed: 1 },
};

export const FAST_DROP_SET: SetDefinition = {
  ...FIXTURE_SET,
  id: 'fast-drop',
  tiers: FIXTURE_SET.tiers.map((tier) => ({ ...tier, buildupPhrases: 0, breakBars: 1 })),
};

export const EFFECTS_CONTENT: GameContent = {
  ...FIXTURE_CONTENT,
  sets: [...FIXTURE_CONTENT.sets, FAST_DROP_SET],
  classes: [
    ...FIXTURE_CONTENT.classes,
    {
      ...raver,
      id: 'roadie',
      skill: {
        id: 'roadie-dash',
        name: 'Ruée',
        description: 'Une ruée en avant.',
        cooldownTicks: 192,
        effect: { kind: 'dash', distance: 120, invulnerableTicks: 12 },
      },
    },
    FIXTURE_CARER,
  ],
  enemies: [...FIXTURE_CONTENT.enemies, FIXTURE_BOUNCER],
  traps: [
    ...FIXTURE_CONTENT.traps,
    trap('beam', 'continuous', { kind: 'beam', damagePerTick: 1, length: 200, width: 20 }),
    FIXTURE_MIST,
    trap('lure', 'continuous', { kind: 'lure', radius: 150, markedDamageMul: 2 }),
    trap('strobe', 'drop', { kind: 'strobe', stunTicks: 24, radius: 120 }),
    trap('metronome', 'bar', { kind: 'shockwave', damage: 1, radius: 10, knockback: 0 }),
  ],
};

export const EFFECTS_OPTIONS: SimulationOptions = { ...FIXTURE_OPTIONS, content: EFFECTS_CONTENT };

export function actionsFor(playerId: PlayerId, ...actions: PlayerAction[]): PlayerCommand {
  return { ...commandFor(playerId), actions };
}

// Removes every enemy after each step: the set then runs on its grid, untouched by combat.
export function peaceful(simulation: Simulation): Simulation {
  return {
    state: simulation.state,
    step(commands) {
      simulation.step(commands);
      simulation.state.enemies.length = 0;
    },
  };
}

export const FIXTURE_HORDE: EnemyDefinition = {
  id: 'queue',
  name: 'File',
  behaviour: 'horde',
  maxHp: 30,
  speed: 2,
  radius: 12,
  damage: 3,
  attackCooldownTicks: 24,
  aggroRadius: 80,
  vibesDrop: 1,
  scalingPerPhrase: { hp: 1, speed: 1 },
};

export const FIXTURE_HEAVY: EnemyDefinition = {
  id: 'doorman',
  name: 'Videur',
  behaviour: 'heavy',
  maxHp: 140,
  speed: 1,
  radius: 20,
  damage: 12,
  attackCooldownTicks: 36,
  aggroRadius: 100,
  vibesDrop: 5,
  scalingPerPhrase: { hp: 1, speed: 1 },
};

export const FIXTURE_SHOOTER: EnemyDefinition = {
  id: 'drizzle',
  name: 'Bruine',
  behaviour: 'shooter',
  maxHp: 24,
  speed: 2,
  radius: 11,
  damage: 5,
  attackCooldownTicks: 48,
  aggroRadius: 220,
  vibesDrop: 2,
  scalingPerPhrase: { hp: 1, speed: 1 },
  ranged: { projectileSpeed: 7, projectileRadius: 6, rangeTicks: 50, keepDistance: 200 },
};

export const FIXTURE_THIEF: EnemyDefinition = {
  id: 'grifter',
  name: 'Arnaqueur',
  behaviour: 'rusher',
  maxHp: 20,
  speed: 2.5,
  radius: 12,
  damage: 5,
  attackCooldownTicks: 24,
  aggroRadius: 120,
  vibesDrop: 1,
  scalingPerPhrase: { hp: 1, speed: 1 },
  special: { kind: 'steal', fleeSpeedMul: 1.5 },
};

export const FIXTURE_CLINGER: EnemyDefinition = {
  id: 'clinger',
  name: 'Collant',
  behaviour: 'rusher',
  maxHp: 20,
  speed: 2.5,
  radius: 12,
  damage: 5,
  attackCooldownTicks: 24,
  aggroRadius: 120,
  vibesDrop: 1,
  scalingPerPhrase: { hp: 1, speed: 1 },
  special: { kind: 'cling', slowFactor: 0.5, detachDamage: 8 },
};

export const FIXTURE_LURE: TrapDefinition = {
  id: 'uv-deco',
  name: 'Déco UV',
  description: 'Attire et marque.',
  radius: 16,
  hp: 50,
  cadence: 'continuous',
  effect: { kind: 'lure', radius: 150, markedDamageMul: 2 },
  lootWeight: 1,
};

export const FIXTURE_PROP: TrapDefinition = {
  id: 'speaker-stack',
  name: "Pile d'enceintes",
  description: 'Un obstacle sans effet.',
  radius: 24,
  hp: 1000,
  cadence: 'bar',
  effect: { kind: 'mist', slowFactor: 1, healPerBar: 0, radius: 1 },
  lootWeight: 1,
};

// The fixture without scheduled waves (the boss still lands on each drop), plus one enemy of each
// behaviour, a lure and an inert prop: combat tests place exactly the enemies they need.
export const COMBAT_CONTENT: GameContent = {
  ...FIXTURE_CONTENT,
  enemies: [
    ...FIXTURE_CONTENT.enemies,
    FIXTURE_HORDE,
    FIXTURE_HEAVY,
    FIXTURE_SHOOTER,
    FIXTURE_THIEF,
    FIXTURE_CLINGER,
  ],
  traps: [...FIXTURE_CONTENT.traps, FIXTURE_LURE, FIXTURE_PROP],
  sets: [{ ...FIXTURE_SET, tiers: FIXTURE_SET.tiers.map((tier) => ({ ...tier, spawns: [] })) }],
};

export const COMBAT_OPTIONS: SimulationOptions = { ...FIXTURE_OPTIONS, content: COMBAT_CONTENT };

const FIXTURE_ENEMIES: ReadonlyMap<string, EnemyDefinition> = new Map(
  [...EFFECTS_CONTENT.enemies, ...COMBAT_CONTENT.enemies].map((enemy) => [enemy.id, enemy]),
);

// Spawns an enemy of any fixture content where a test needs it, as the spawning system would.
export function placeEnemy(state: SimState, kind: string, x: number, y: number): EnemyState {
  const definition = FIXTURE_ENEMIES.get(kind);
  if (definition === undefined) {
    throw new Error(`no fixture enemy "${kind}"`);
  }
  return spawnEnemy(state, definition, x, y, definition.behaviour === 'boss');
}

export const FIXTURE_BYSTANDER: BystanderDefinition = {
  id: 'festivalier',
  name: 'Festivalier en détresse',
  description: 'À aider, pas à chasser.',
  radius: 14,
  speed: 2,
  helpTicks: 10,
  vibesReward: 5,
  vibesPenalty: 3,
  lifetimeBars: 4,
};

export const BYSTANDER_SET: SetDefinition = {
  ...FIXTURE_SET,
  id: 'bystander-set',
  tiers: FIXTURE_SET.tiers.map((tier) => ({
    ...tier,
    spawns: [],
    bystanderSpawns: [{ bystanderId: FIXTURE_BYSTANDER.id, everyBars: 2, count: 1, fromPhrase: 0 }],
  })),
};

// A fixture with no bad vibes scheduled, the carer's heal pulse, a mist trap, and a Festivalier
// spawning every other bar: bystander tests place exactly the enemies and traps they need.
export const BYSTANDER_CONTENT: GameContent = {
  ...FIXTURE_CONTENT,
  classes: [...FIXTURE_CONTENT.classes, FIXTURE_CARER],
  traps: [...FIXTURE_CONTENT.traps, FIXTURE_MIST],
  bystanders: [FIXTURE_BYSTANDER],
  sets: [BYSTANDER_SET],
};

export const BYSTANDER_OPTIONS: SimulationOptions = {
  ...FIXTURE_OPTIONS,
  setId: BYSTANDER_SET.id,
  content: BYSTANDER_CONTENT,
};

// No bad vibe and no Festivalier spawns scheduled: tests place exactly the bystander they need.
export const BYSTANDER_QUIET_SET: SetDefinition = {
  ...BYSTANDER_SET,
  id: 'bystander-quiet-set',
  tiers: BYSTANDER_SET.tiers.map((tier) => ({ ...tier, bystanderSpawns: [] })),
};

export const BYSTANDER_QUIET_CONTENT: GameContent = {
  ...BYSTANDER_CONTENT,
  sets: [BYSTANDER_QUIET_SET],
};

export const BYSTANDER_QUIET_OPTIONS: SimulationOptions = {
  ...FIXTURE_OPTIONS,
  setId: BYSTANDER_QUIET_SET.id,
  content: BYSTANDER_QUIET_CONTENT,
};

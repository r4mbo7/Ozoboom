import type { EnemyDefinition, GameContent, SetDefinition, TrapDefinition } from '../data/types';
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
      wattsDrop: 25,
      scalingPerPhrase: { hp: 1.2, speed: 1 },
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

const trap = (
  id: string,
  cadence: TrapDefinition['cadence'],
  effect: TrapDefinition['effect'],
): TrapDefinition => ({
  id,
  name: id,
  description: id,
  cost: 20,
  radius: 16,
  hp: 50,
  cadence,
  effect,
  maxLevel: 3,
  levelMul: 2,
});

const [raver] = FIXTURE_CONTENT.classes;
if (raver === undefined) {
  throw new Error('expected the raver class');
}

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
  wattsDrop: 3,
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
        id: 'roadie-barrier',
        name: 'Barrière',
        description: 'Une barrière autour de soi.',
        cooldownTicks: 192,
        effect: { kind: 'barrier', hp: 60, radius: 100, durationTicks: 96 },
      },
      ultimate: {
        id: 'roadie-dash',
        name: 'Ruée',
        description: 'Une ruée en avant.',
        cooldownTicks: 0,
        effect: { kind: 'dash', distance: 120, invulnerableTicks: 12 },
      },
    },
    {
      ...raver,
      id: 'carer',
      skill: {
        id: 'carer-pulse',
        name: 'Pulsation',
        description: 'Soigne autour de soi.',
        cooldownTicks: 192,
        effect: { kind: 'healPulse', amount: 30, radius: 150, coreRepair: 50 },
      },
      ultimate: {
        id: 'carer-dash',
        name: 'Ruée',
        description: 'Une ruée en avant.',
        cooldownTicks: 0,
        effect: { kind: 'dash', distance: 80, invulnerableTicks: 6 },
      },
    },
  ],
  enemies: [...FIXTURE_CONTENT.enemies, FIXTURE_BOUNCER],
  traps: [
    ...FIXTURE_CONTENT.traps,
    trap('beam', 'continuous', { kind: 'beam', damagePerTick: 1, length: 200, width: 20 }),
    trap('mister', 'continuous', { kind: 'mist', slowFactor: 0.5, healPerBar: 10, radius: 80 }),
    trap('lure', 'continuous', { kind: 'lure', radius: 150, markedDamageMul: 2 }),
    trap('strobe', 'drop', { kind: 'strobe', stunTicks: 24, radius: 120 }),
    trap('metronome', 'bar', { kind: 'shockwave', damage: 1, radius: 10, knockback: 0 }),
  ],
};

export const EFFECTS_OPTIONS: SimulationOptions = { ...FIXTURE_OPTIONS, content: EFFECTS_CONTENT };

export function addEnemy(
  state: SimState,
  definition: EnemyDefinition,
  x: number,
  y: number,
): EnemyState {
  const enemy: EnemyState = {
    id: state.nextEntityId,
    kind: definition.id,
    x,
    y,
    prevX: x,
    prevY: y,
    radius: definition.radius,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    speed: definition.speed,
    damage: definition.damage,
    target: 'core',
    attackCooldown: 0,
    slowFactor: 1,
    stunTicks: 0,
    marked: false,
    isBoss: definition.behaviour === 'boss',
  };
  state.nextEntityId += 1;
  state.enemies.push(enemy);
  return enemy;
}

export function actionsFor(playerId: PlayerId, ...actions: PlayerAction[]): PlayerCommand {
  return { ...commandFor(playerId), actions };
}

export function enemyDefinition(id: string): EnemyDefinition {
  const definition = EFFECTS_CONTENT.enemies.find((enemy) => enemy.id === id);
  if (definition === undefined) {
    throw new Error(`no fixture enemy "${id}"`);
  }
  return definition;
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
  wattsDrop: 0,
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
  wattsDrop: 3,
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
  wattsDrop: 1,
  scalingPerPhrase: { hp: 1, speed: 1 },
  ranged: { projectileSpeed: 7, rangeTicks: 50, keepDistance: 200 },
};

export const FIXTURE_LURE: TrapDefinition = {
  id: 'uv-deco',
  name: 'Déco UV',
  description: 'Attire et marque.',
  cost: 20,
  radius: 16,
  hp: 50,
  cadence: 'continuous',
  effect: { kind: 'lure', radius: 150, markedDamageMul: 2 },
  maxLevel: 3,
  levelMul: 1.5,
};

export const FIXTURE_PROP: TrapDefinition = {
  id: 'speaker-stack',
  name: "Pile d'enceintes",
  description: 'Un obstacle sans effet.',
  cost: 20,
  radius: 24,
  hp: 1000,
  cadence: 'bar',
  effect: { kind: 'mist', slowFactor: 1, healPerBar: 0, radius: 1 },
  maxLevel: 1,
  levelMul: 1,
};

// The fixture without scheduled waves (the boss still lands on each drop), plus one enemy of each
// behaviour, a lure and an inert prop: combat tests place exactly the enemies they need.
export const COMBAT_CONTENT: GameContent = {
  ...FIXTURE_CONTENT,
  enemies: [...FIXTURE_CONTENT.enemies, FIXTURE_HORDE, FIXTURE_HEAVY, FIXTURE_SHOOTER],
  traps: [...FIXTURE_CONTENT.traps, FIXTURE_LURE, FIXTURE_PROP],
  sets: [{ ...FIXTURE_SET, tiers: FIXTURE_SET.tiers.map((tier) => ({ ...tier, spawns: [] })) }],
};

export const COMBAT_OPTIONS: SimulationOptions = { ...FIXTURE_OPTIONS, content: COMBAT_CONTENT };

export function placeEnemy(state: SimState, kind: string, x: number, y: number): EnemyState {
  const definition = COMBAT_CONTENT.enemies.find((enemy) => enemy.id === kind);
  if (definition === undefined) {
    throw new Error(`no fixture enemy "${kind}"`);
  }
  return spawnEnemy(state, definition, x, y, definition.behaviour === 'boss');
}

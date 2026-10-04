import type { ClassDefinition, SetDefinition } from '../data/types';
import { seedRng } from '../shared/prng';
import { IDLE_INPUT } from './commands';
import { lookup, type ResolvedContent } from './content';
import type { CoreState, PlayerId, PlayerState, SimState, Vec2 } from './state';

export interface PlayerSlot {
  id: PlayerId;
  classId: string;
}

const SPAWN_DIRECTIONS: readonly Vec2[] = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
];
const SPAWN_GAP_IN_PLAYER_RADII = 3;

export function createInitialState(
  seed: number,
  slots: readonly PlayerSlot[],
  content: ResolvedContent,
  set: SetDefinition,
): SimState {
  if (slots.length === 0 || slots.length > SPAWN_DIRECTIONS.length) {
    throw new RangeError(
      `a game needs 1 to ${String(SPAWN_DIRECTIONS.length)} players, got ${String(slots.length)}`,
    );
  }
  const ids = new Set(slots.map((slot) => slot.id));
  if (ids.size !== slots.length) {
    throw new Error(`player ids must be unique, got ${slots.map((slot) => slot.id).join(', ')}`);
  }

  const core: CoreState = {
    x: set.arena.width / 2,
    y: set.arena.height / 2,
    radius: set.core.radius,
    hp: set.core.maxHp,
    maxHp: set.core.maxHp,
    watts: set.startingWatts,
  };

  return {
    seed,
    setId: set.id,
    tick: 0,
    status: 'running',
    rng: seedRng(seed),
    arena: { width: set.arena.width, height: set.arena.height },
    set: { tier: 0, segment: 'buildup', phrase: 0, bar: 0, beat: 0, segmentStartTick: 0 },
    core,
    players: slots.map((slot, index) =>
      createPlayer(slot, lookup(content.classes, slot.classId, 'class'), core, index, set),
    ),
    enemies: [],
    projectiles: [],
    traps: [],
    pickups: [],
    laserShows: [],
    barriers: [],
    pendingUpgrades: [],
    nextEntityId: 1,
    stats: { kills: 0, phrasesHeld: 0, damageDealt: 0, vibesCollected: 0, wattsSpent: 0 },
    events: [],
  };
}

function createPlayer(
  slot: PlayerSlot,
  definition: ClassDefinition,
  core: CoreState,
  index: number,
  set: SetDefinition,
): PlayerState {
  const direction = SPAWN_DIRECTIONS[index] ?? { x: 0, y: 0 };
  const distance = core.radius + definition.radius * SPAWN_GAP_IN_PLAYER_RADII;
  const x = core.x + direction.x * distance;
  const y = core.y + direction.y * distance;
  return {
    id: slot.id,
    classId: definition.id,
    x,
    y,
    prevX: x,
    prevY: y,
    radius: definition.radius,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    speed: definition.speed,
    aim: IDLE_INPUT.aim,
    level: 1,
    vibes: 0,
    vibesToNextLevel: set.levelCurve.baseVibes,
    attackCooldown: 0,
    skillCooldown: 0,
    ultimateReady: false,
    upgrades: [],
    modifiers: {},
    downed: false,
    invulnerableTicks: 0,
  };
}

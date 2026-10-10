import type {
  EnemyState,
  PickupState,
  PlayerId,
  PlayerState,
  Positioned,
  ProjectileState,
  RngState,
  SimState,
  TrapState,
} from '../sim/state';
import { BYSTANDERS } from '../data/bystanders';
import { ENEMIES } from '../data/enemies';
import { SETS } from '../data/sets';
import { TRAPS } from '../data/traps';
import type { TrapDefinition } from '../data/types';
import { WEAPONS } from '../data/weapons';
import type { RenderContent } from './context';
import { FIXTURE_CLASSES } from './fixture-classes';

const OTHER_TRAPS: readonly Pick<TrapDefinition, 'id' | 'radius' | 'effect'>[] = [
  {
    id: 'brumisateur',
    radius: 16,
    effect: { kind: 'mist', slowFactor: 0.6, healPerBar: 1, radius: 90 },
  },
  { id: 'deco-uv', radius: 15, effect: { kind: 'lure', radius: 140, markedDamageMul: 1.5 } },
  { id: 'stroboscope', radius: 15, effect: { kind: 'strobe', stunTicks: 30, radius: 100 } },
];

export const FIXTURE_CONTENT: RenderContent = {
  classes: FIXTURE_CLASSES,
  weapons: WEAPONS,
  sets: SETS,
  enemies: ENEMIES,
  bystanders: BYSTANDERS,
  traps: [...TRAPS, ...OTHER_TRAPS],
};

export interface FixtureOptions {
  enemies: number;
  projectiles: number;
  showcase?: boolean;
}

interface Breed {
  kind: string;
  radius: number;
  speed: number;
  holdAt: number;
  share: number;
}

const BREEDS: readonly Breed[] = ENEMIES.filter(({ behaviour }) => behaviour !== 'boss').map(
  (def) => ({
    kind: def.id,
    radius: def.radius,
    speed: def.speed,
    holdAt: def.behaviour === 'shooter' ? 300 : 0,
    share: def.id === 'random' ? 0.2 : 0.08,
  }),
);
const BOSS: Breed = { kind: 'couvre-feu', radius: 40, speed: 0.4, holdAt: 240, share: 0 };
const ARENA = { width: 1600, height: 1000 };
export const PLAYER_ORBIT = 230;
export const PARTY_OFFSET = 64;
const PARTY = ['mage', 'tank', 'healer'];
export const TAU = Math.PI * 2;

export function nextRandom(rng: RngState): number {
  rng.a = (rng.a + 0x6d2b79f5) | 0;
  let value = Math.imul(rng.a ^ (rng.a >>> 15), 1 | rng.a);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

export function breedOf(kind: string): Breed {
  return BREEDS.find((breed) => breed.kind === kind) ?? BOSS;
}

function pickBreed(rng: RngState): Breed {
  let roll = nextRandom(rng);
  for (const breed of BREEDS) {
    roll -= breed.share;
    if (roll < 0) {
      return breed;
    }
  }
  return BREEDS[0] ?? BOSS;
}

export function at<T extends object>(entity: T, x: number, y: number): T & Positioned {
  return { ...entity, x, y, prevX: x, prevY: y };
}

export function teleport(entity: Positioned, x: number, y: number): void {
  entity.x = entity.prevX = x;
  entity.y = entity.prevY = y;
}

export function spawnEnemy(state: SimState, breed: Breed, anywhere: boolean): EnemyState {
  const { rng, arena } = state;
  let x: number;
  let y: number;
  if (anywhere) {
    do {
      x = nextRandom(rng) * arena.width;
      y = nextRandom(rng) * arena.height;
    } while (Math.hypot(x - state.core.x, y - state.core.y) < 160);
  } else {
    const side = Math.floor(nextRandom(rng) * 4);
    const along = nextRandom(rng);
    x = side === 1 ? arena.width : side === 3 ? 0 : along * arena.width;
    y = side === 0 ? 0 : side === 2 ? arena.height : along * arena.height;
  }
  state.nextEntityId += 1;
  return at(
    {
      id: state.nextEntityId,
      kind: breed.kind,
      radius: breed.radius,
      hp: 10,
      maxHp: 10,
      speed: breed.speed,
      damage: 1,
      target: 'core',
      attackCooldown: 0,
      slowFactor: 1,
      stunTicks: state.nextEntityId % 12 === 0 ? 1_000_000 : 0,
      marked: false,
      isBoss: breed === BOSS,
    },
    x,
    y,
  );
}

export function fire(state: SimState, projectile: ProjectileState): void {
  const { rng } = state;
  const player = state.players[0];
  const shooters = state.enemies.filter((enemy) => enemy.kind === 'meprisant');
  const shooter = shooters[Math.floor(nextRandom(rng) * shooters.length)];
  state.nextEntityId += 1;
  projectile.id = state.nextEntityId;
  if (player !== undefined && (shooter === undefined || nextRandom(rng) < 0.88)) {
    const angle = Math.atan2(player.aim.y, player.aim.x) + (nextRandom(rng) - 0.5) * 3.6;
    projectile.owner = { kind: 'player', playerId: player.id };
    projectile.vx = Math.cos(angle) * 8;
    projectile.vy = Math.sin(angle) * 8;
    projectile.radius = 4;
    projectile.ticksLeft = 18 + Math.floor(nextRandom(rng) * 22);
    teleport(projectile, player.x, player.y);
  } else if (shooter !== undefined) {
    const angle = Math.atan2(state.core.y - shooter.y, state.core.x - shooter.x);
    projectile.owner = { kind: 'enemy', enemyId: shooter.id };
    projectile.vx = Math.cos(angle) * 3.5;
    projectile.vy = Math.sin(angle) * 3.5;
    projectile.radius = 5;
    projectile.ticksLeft = 60;
    teleport(projectile, shooter.x, shooter.y);
  }
}

export function spawnPickup(state: SimState): PickupState {
  const { rng, core } = state;
  const angle = nextRandom(rng) * TAU;
  const distance = 90 + nextRandom(rng) * 380;
  state.nextEntityId += 1;
  return at(
    {
      id: state.nextEntityId,
      kind: nextRandom(rng) < 0.7 ? 'vibes' : 'watts',
      amount: 1,
      ticksLeft: 200 + Math.floor(nextRandom(rng) * 400),
    },
    core.x + Math.cos(angle) * distance,
    core.y + Math.sin(angle) * distance,
  );
}

function createTraps(state: SimState, showcase: boolean): TrapState[] {
  const layout = [
    { kind: 'caisson-de-basse', angle: -Math.PI / 2, distance: 150 },
    { kind: 'caisson-de-basse', angle: Math.PI / 6, distance: 150 },
    { kind: 'caisson-de-basse', angle: (5 * Math.PI) / 6, distance: 150 },
    { kind: 'laser', angle: Math.PI / 2, distance: 120 },
    { kind: 'laser', angle: -Math.PI / 6, distance: 330 },
  ];
  if (showcase) {
    layout.push(
      { kind: 'brumisateur', angle: -Math.PI / 4, distance: 200 },
      { kind: 'deco-uv', angle: (3 * Math.PI) / 4, distance: 230 },
      { kind: 'stroboscope', angle: (-3 * Math.PI) / 4, distance: 210 },
    );
  }
  return layout.map(({ kind, angle, distance }) => {
    state.nextEntityId += 1;
    return at(
      {
        id: state.nextEntityId,
        kind,
        ownerId: 0,
        direction: { x: Math.cos(angle), y: Math.sin(angle) },
        hp: 100,
        cooldown: 0,
      },
      state.core.x + Math.cos(angle) * distance,
      state.core.y + Math.sin(angle) * distance,
    );
  });
}

export function createFixtureState(options: FixtureOptions): SimState {
  const state: SimState = {
    seed: 5,
    setId: 'soiree-v0',
    tick: 0,
    status: 'running',
    rng: { a: 5, b: 0, c: 0, d: 0 },
    arena: { ...ARENA },
    set: { tier: 0, segment: 'buildup', phrase: 0, bar: 0, beat: 0, segmentStartTick: 0 },
    core: {
      x: ARENA.width / 2,
      y: ARENA.height / 2,
      radius: 46,
      hp: 100,
      maxHp: 100,
      watts: 20,
    },
    players: [],
    enemies: [],
    projectiles: [],
    traps: [],
    pickups: [],
    pendingUpgrades: [],
    nextEntityId: 0,
    stats: { kills: 0, phrasesHeld: 0, damageDealt: 0, vibesCollected: 0, wattsSpent: 0 },
    events: [],
  };
  state.players.push(
    ...PARTY.map((classId, id) =>
      at<Omit<PlayerState, keyof Positioned>>(
        {
          id: id as PlayerId,
          classId,
          radius: 14,
          hp: 100,
          maxHp: 100,
          speed: 3,
          aim: { x: 1, y: 0 },
          level: 1,
          vibes: 0,
          vibesToNextLevel: 10,
          attackCooldown: 0,
          skillCooldown: 0,
          upgrades: [],
          modifiers: {},
          downed: false,
        },
        state.core.x + PLAYER_ORBIT,
        state.core.y + PARTY_OFFSET * (id === 0 ? 0 : id === 1 ? -1 : 1),
      ),
    ),
  );
  state.traps = createTraps(state, options.showcase === true);
  state.enemies.push(spawnEnemy(state, BOSS, true));
  while (state.enemies.length < options.enemies) {
    state.enemies.push(spawnEnemy(state, pickBreed(state.rng), true));
  }
  state.enemies.length = options.enemies;
  for (let index = 0; index < 30; index += 1) {
    state.pickups.push(spawnPickup(state));
  }
  for (let index = 0; index < options.projectiles; index += 1) {
    const projectile: ProjectileState = {
      id: 0,
      owner: { kind: 'player', playerId: 0 },
      vx: 0,
      vy: 0,
      radius: 4,
      damage: 1,
      ticksLeft: 0,
      pierceLeft: 0,
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
    };
    fire(state, projectile);
    projectile.ticksLeft = Math.floor(nextRandom(state.rng) * projectile.ticksLeft);
    state.projectiles.push(projectile);
  }
  return state;
}

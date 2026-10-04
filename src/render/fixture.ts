import type {
  EnemyState,
  PickupState,
  PlayerState,
  Positioned,
  ProjectileState,
  RngState,
  SimEvent,
  SimState,
  TrapState,
} from '../sim/state';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import type { RenderContent } from './scene';

export const FIXTURE_CONTENT: RenderContent = {
  classes: [{ id: 'mage', color: '#ff2bd6' }],
  enemies: [
    { id: 'relou', behaviour: 'rusher' },
    { id: 'foule-au-bar', behaviour: 'horde' },
    { id: 'vigile', behaviour: 'heavy' },
    { id: 'pluie', behaviour: 'shooter' },
    { id: 'couvre-feu', behaviour: 'boss' },
  ],
  traps: [
    {
      id: 'caisson-de-basse',
      radius: 18,
      effect: { kind: 'shockwave', damage: 6, radius: 110, knockback: 24 },
    },
    { id: 'laser', radius: 14, effect: { kind: 'beam', damagePerTick: 1, length: 360, width: 12 } },
  ],
};

export type FixtureEvent = 'beat' | 'enemyDied' | 'coreHit';

export interface FixtureOptions {
  enemies: number;
  projectiles: number;
}

interface Breed {
  kind: string;
  radius: number;
  speed: number;
  holdAt: number;
  share: number;
}

const BREEDS: readonly Breed[] = [
  { kind: 'foule-au-bar', radius: 7, speed: 1.3, holdAt: 0, share: 0.42 },
  { kind: 'relou', radius: 9, speed: 2.2, holdAt: 0, share: 0.28 },
  { kind: 'vigile', radius: 14, speed: 0.6, holdAt: 0, share: 0.14 },
  { kind: 'pluie', radius: 10, speed: 1, holdAt: 300, share: 0.16 },
];
const BOSS: Breed = { kind: 'couvre-feu', radius: 40, speed: 0.4, holdAt: 240, share: 0 };
const ARENA = { width: 1600, height: 1000 };
const CORE_RADIUS = 46;
const PLAYER_ORBIT = 230;
const TAU = Math.PI * 2;

function nextRandom(rng: RngState): number {
  rng.a = (rng.a + 0x6d2b79f5) | 0;
  let value = Math.imul(rng.a ^ (rng.a >>> 15), 1 | rng.a);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function breedOf(kind: string): Breed {
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

function at<T extends object>(entity: T, x: number, y: number): T & Positioned {
  return { ...entity, x, y, prevX: x, prevY: y };
}

function teleport(entity: Positioned, x: number, y: number): void {
  entity.x = entity.prevX = x;
  entity.y = entity.prevY = y;
}

function spawnEnemy(state: SimState, breed: Breed, anywhere: boolean): EnemyState {
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
      stunTicks: 0,
      marked: false,
      isBoss: breed === BOSS,
    },
    x,
    y,
  );
}

function fire(state: SimState, projectile: ProjectileState): void {
  const { rng } = state;
  const player = state.players[0];
  const shooters = state.enemies.filter((enemy) => enemy.kind === 'pluie');
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

function spawnPickup(state: SimState): PickupState {
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

function createTraps(state: SimState): TrapState[] {
  const layout = [
    { kind: 'caisson-de-basse', angle: -Math.PI / 2, distance: 150 },
    { kind: 'caisson-de-basse', angle: Math.PI / 6, distance: 150 },
    { kind: 'caisson-de-basse', angle: (5 * Math.PI) / 6, distance: 150 },
    { kind: 'laser', angle: Math.PI / 2, distance: 120 },
    { kind: 'laser', angle: -Math.PI / 6, distance: 330 },
  ];
  return layout.map(({ kind, angle, distance }) => {
    state.nextEntityId += 1;
    return at(
      {
        id: state.nextEntityId,
        kind,
        ownerId: 0,
        level: 1,
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
      radius: CORE_RADIUS,
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
    at<Omit<PlayerState, keyof Positioned>>(
      {
        id: 0,
        classId: 'mage',
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
        ultimateReady: false,
        upgrades: [],
        modifiers: {},
        downed: false,
      },
      state.core.x + PLAYER_ORBIT,
      state.core.y,
    ),
  );
  state.traps = createTraps(state);
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

function killRandomEnemy(state: SimState, events: SimEvent[]): void {
  const index = Math.floor(nextRandom(state.rng) * state.enemies.length);
  const enemy = state.enemies[index];
  if (enemy === undefined || enemy.isBoss) {
    return;
  }
  events.push({
    type: 'enemyDied',
    id: enemy.id,
    kind: enemy.kind,
    x: enemy.x,
    y: enemy.y,
    byPlayer: 0,
  });
  state.enemies[index] = spawnEnemy(state, breedOf(enemy.kind), false);
}

export function advanceFixture(state: SimState, queued: readonly FixtureEvent[]): void {
  const events: SimEvent[] = [];
  state.events = events;
  state.tick += 1;
  const { tick, core } = state;

  for (const entity of [
    ...state.players,
    ...state.enemies,
    ...state.projectiles,
    ...state.pickups,
  ]) {
    entity.prevX = entity.x;
    entity.prevY = entity.y;
  }
  for (const trap of state.traps) {
    trap.prevX = trap.x;
    trap.prevY = trap.y;
  }

  const beat = tick % TICKS_PER_BEAT === 0;
  if (beat || queued.includes('beat')) {
    events.push({ type: 'beat', beat: Math.floor(tick / TICKS_PER_BEAT) });
  }
  if (beat) {
    for (const trap of state.traps) {
      if (trap.kind === 'caisson-de-basse') {
        events.push({ type: 'trapFired', id: trap.id, kind: trap.kind, x: trap.x, y: trap.y });
      }
    }
  }
  if (queued.includes('coreHit')) {
    events.push({ type: 'coreHit', damage: 5 });
  }
  if (queued.includes('enemyDied') || tick % 7 === 0) {
    killRandomEnemy(state, events);
  }

  const player = state.players[0];
  if (player !== undefined && !player.downed) {
    const orbit = (tick / (TICKS_PER_BAR * 8)) * TAU;
    const wobble = PLAYER_ORBIT + Math.sin(tick / 23) * 60;
    player.x = core.x + Math.cos(orbit) * wobble;
    player.y = core.y + Math.sin(orbit) * wobble * 0.8;
    const aimAngle = orbit + Math.sin(tick / 17) * 0.9;
    player.aim = { x: Math.cos(aimAngle), y: Math.sin(aimAngle) };
  }

  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    if (enemy === undefined) {
      continue;
    }
    const breed = breedOf(enemy.kind);
    const dx = core.x - enemy.x;
    const dy = core.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    if (distance < core.radius + enemy.radius) {
      state.enemies[index] = spawnEnemy(state, breed, false);
      continue;
    }
    const sway = Math.sin(tick / 9 + enemy.id) * 0.45;
    const forward = distance > breed.holdAt ? enemy.speed : 0;
    const side = breed.holdAt > 0 ? enemy.speed * 0.5 : enemy.speed * sway;
    enemy.x += (dx / distance) * forward - (dy / distance) * side;
    enemy.y += (dy / distance) * forward + (dx / distance) * side;
  }

  for (const projectile of state.projectiles) {
    projectile.ticksLeft -= 1;
    if (projectile.ticksLeft <= 0) {
      fire(state, projectile);
      continue;
    }
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;
  }

  for (let index = 0; index < state.pickups.length; index += 1) {
    const pickup = state.pickups[index];
    if (pickup === undefined) {
      continue;
    }
    pickup.ticksLeft -= 1;
    if (pickup.ticksLeft <= 0) {
      state.pickups[index] = spawnPickup(state);
    }
  }

  for (const trap of state.traps) {
    if (trap.kind === 'laser') {
      const turned = Math.atan2(trap.direction.y, trap.direction.x) + 0.012;
      trap.direction = { x: Math.cos(turned), y: Math.sin(turned) };
    }
  }

  state.set.beat = Math.floor(tick / TICKS_PER_BEAT);
  state.set.bar = Math.floor(tick / TICKS_PER_BAR);
}

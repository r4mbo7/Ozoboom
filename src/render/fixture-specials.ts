import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import type { BystanderState, EnemyState, SimEvent, SimState } from '../sim/state';
import { createFixtureState } from './fixture';

// A still scene of the special bad vibes and the Festivalier en détresse, replayed every 4 bars.
const CYCLE = TICKS_PER_BAR * 4;
const HELP_FROM = 20;
const LOST_AT = 120;
const REVIVE_AT = 40;
const ALPHAS = [
  { id: 12, x: 1230, y: 330, front: true },
  { id: 13, x: 1230, y: 450, front: false },
];
const ALPHA_STEP = 0.4;
const BABBLES = [
  { id: 6, at: 10 },
  { id: 7, at: 22 },
];

function enemy(
  id: number,
  kind: string,
  x: number,
  y: number,
  extra: Partial<EnemyState> = {},
): EnemyState {
  return {
    id,
    kind,
    x,
    y,
    prevX: x,
    prevY: y,
    radius: 12,
    hp: 10,
    maxHp: 10,
    speed: 1,
    damage: 1,
    target: 'core',
    attackCooldown: 0,
    slowFactor: 1,
    stunTicks: 0,
    marked: false,
    isBoss: false,
    ...extra,
  };
}

function bystander(id: number, x: number, y: number): BystanderState {
  return {
    id,
    kind: 'festivalier-en-detresse',
    x,
    y,
    prevX: x,
    prevY: y,
    radius: 11,
    targetX: x,
    targetY: y,
    helpTicks: 0,
    ticksLeft: 4 * TICKS_PER_BAR,
  };
}

export function createSpecialsState(): SimState {
  const state = createFixtureState({ enemies: 0, projectiles: 0 });
  state.core.x = 150;
  state.traps = [];
  state.pickups = [
    { id: 20, kind: 'vibes', amount: 1, ticksLeft: 99999, x: 590, y: 520, prevX: 590, prevY: 520 },
    { id: 21, kind: 'watts', amount: 1, ticksLeft: 99999, x: 535, y: 470, prevX: 535, prevY: 470 },
  ];
  const [first] = state.players;
  if (first !== undefined) {
    first.x = first.prevX = 800;
    first.y = first.prevY = 520;
    first.dazzledTicks = 2;
    first.aim = { x: 0, y: -1 };
    state.players.push({
      ...first,
      id: 1,
      x: 570,
      y: 545,
      prevX: 570,
      prevY: 545,
      dazzledTicks: 0,
      suppressedTicks: 2,
      aim: { x: 1, y: 0 },
    });
  }
  state.enemies = [
    enemy(1, 'intolerant', 560, 470, { radius: 13, target: 1 }),
    enemy(2, 'random', 515, 415),
    enemy(3, 'random', 615, 425),
    enemy(4, 'filmeur', 800, 430, { radius: 11, target: 0 }),
    enemy(5, 'fatigue', 1010, 450, { radius: 13 }),
    enemy(6, 'bavard', 690, 330, { radius: 11 }),
    enemy(7, 'bavard', 920, 320, { radius: 11 }),
    enemy(8, 'fatigue', 1100, 540, { radius: 13, stunTicks: 99999 }),
    enemy(9, 'collant', 690, 640, { clingingTo: 0 }),
    enemy(10, 'arnaqueur', 910, 640, { carrying: 3, fleeing: true }),
    enemy(11, 'zombie', 1010, 640, { radius: 20, hp: 0, downTicks: 99999 }),
    ...ALPHAS.map(({ id, x, y }) => enemy(id, 'male-alpha', x, y, { radius: 20 })),
  ];
  return state;
}

export function advanceSpecials(state: SimState): void {
  const events: SimEvent[] = [];
  state.events = events;
  state.tick += 1;
  const at = state.tick % CYCLE;
  for (const entity of [...state.players, ...state.enemies]) {
    entity.prevX = entity.x;
    entity.prevY = entity.y;
  }

  // Two Mâle alpha walk left, hit on each beat: the upper one on its front, the lower one from behind.
  for (const alpha of ALPHAS) {
    const walker = state.enemies.find((candidate) => candidate.id === alpha.id);
    if (walker !== undefined) {
      walker.x = alpha.x - ALPHA_STEP * at;
      walker.prevX = walker.x + ALPHA_STEP;
      if (at % TICKS_PER_BEAT === 0) {
        const hit = {
          type: 'enemyHit',
          id: alpha.id,
          damage: 1,
          x: walker.x,
          y: walker.y,
        } as const;
        events.push(alpha.front ? { ...hit, front: true } : hit);
      }
    }
  }
  if (at === 1) {
    state.bystanders = [bystander(900, 620, 700), bystander(901, 980, 720)];
    const zombie = state.enemies.find((candidate) => candidate.kind === 'zombie');
    if (zombie !== undefined) {
      zombie.hp = 0;
      zombie.downTicks = 99999;
    }
  }
  for (const { id, at: babbleAt } of BABBLES) {
    const speaker = state.enemies.find((candidate) => candidate.id === id);
    if (at === babbleAt && speaker !== undefined) {
      events.push({ type: 'enemyBabbled', id, kind: speaker.kind, x: speaker.x, y: speaker.y });
    }
  }
  const zombie = state.enemies.find((candidate) => candidate.kind === 'zombie');
  if (at === REVIVE_AT && zombie !== undefined) {
    zombie.hp = 5;
    delete zombie.downTicks;
    events.push({
      type: 'enemyRevived',
      id: zombie.id,
      kind: zombie.kind,
      x: zombie.x,
      y: zombie.y,
    });
  }

  const helped = state.bystanders?.find((candidate) => candidate.id === 900);
  if (helped !== undefined && at > HELP_FROM) {
    helped.helpTicks = at - HELP_FROM;
    if (helped.helpTicks >= TICKS_PER_BAR) {
      events.push({
        type: 'bystanderHelped',
        id: helped.id,
        kind: helped.kind,
        x: helped.x,
        y: helped.y,
      });
      state.bystanders = (state.bystanders ?? []).filter((candidate) => candidate.id !== helped.id);
    }
  }
  const lost = state.bystanders?.find((candidate) => candidate.id === 901);
  if (lost !== undefined && at === LOST_AT) {
    events.push({ type: 'bystanderLost', id: lost.id, kind: lost.kind, x: lost.x, y: lost.y });
    state.bystanders = (state.bystanders ?? []).filter((candidate) => candidate.id !== lost.id);
  }

  state.set.beat = Math.floor(state.tick / TICKS_PER_BEAT);
  state.set.bar = Math.floor(state.tick / TICKS_PER_BAR);
  if (state.tick % TICKS_PER_BEAT === 0) {
    events.push({ type: 'beat', beat: state.set.beat });
  }
}

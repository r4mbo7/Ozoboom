import type { EnemyDefinition, SetDefinition } from '../../data/types';
import { nextFloat, nextInt, pick } from '../../shared/prng';
import { BARS_PER_PHRASE, barOfTick, isBarTick, type Tempo } from '../../shared/tempo';
import { lookup } from '../content';
import { compound } from '../effects';
import { volumeMul } from '../volume';
import type { Arena, EdgeSide, EnemyState, SimState, Vec2 } from '../state';
import type { StepContext } from './types';

export function spawning({ state, content, set, tempo }: StepContext): void {
  for (const event of state.events) {
    if (event.type === 'segment' && event.segment === 'drop') {
      const tier = set.tiers[event.tier];
      if (tier !== undefined) {
        spawnAtEdge(state, set, tempo, lookup(content.enemies, tier.bossId, 'enemy'), true);
      }
    }
  }

  const tier = set.tiers[state.set.tier];
  if (tier === undefined || !isBarTick(state.tick, tempo)) {
    return;
  }
  const rules = { buildup: tier.spawns, break: [], drop: tier.dropSpawns ?? [] }[state.set.segment];
  const bar = (state.tick - state.set.segmentStartTick) / tempo.ticksPerBar;
  const phrase = Math.floor(bar / BARS_PER_PHRASE);
  for (const rule of rules) {
    const active =
      phrase >= rule.fromPhrase && (rule.toPhrase === undefined || phrase <= rule.toPhrase);
    if (!active || bar % rule.everyBars !== 0) {
      continue;
    }
    const definition = lookup(content.enemies, rule.enemyId, 'enemy');
    const count = Math.ceil(scaledCount(state, set, rule.count) * volumeMul(state));
    for (let i = 0; i < count; i++) {
      spawnAtEdge(state, set, tempo, definition, false);
    }
  }
}

export function spawnEnemy(
  state: SimState,
  definition: EnemyDefinition,
  x: number,
  y: number,
  isBoss: boolean,
  hpMul = 1,
): EnemyState {
  const phrase = state.set.phrase;
  const maxHp =
    definition.maxHp * compound(definition.scalingPerPhrase.hp, phrase) * volumeMul(state) * hpMul;
  const enemy: EnemyState = {
    id: state.nextEntityId,
    kind: definition.id,
    x,
    y,
    prevX: x,
    prevY: y,
    radius: definition.radius,
    hp: maxHp,
    maxHp,
    speed: definition.speed * compound(definition.scalingPerPhrase.speed, phrase),
    damage: definition.damage,
    target: 'core',
    attackCooldown: 0,
    slowFactor: 1,
    stunTicks: 0,
    marked: false,
    isBoss,
  };
  state.nextEntityId += 1;
  state.enemies.push(enemy);
  state.events.push({ type: 'enemySpawned', id: enemy.id, kind: enemy.kind, x, y });
  return enemy;
}

function spawnAtEdge(
  state: SimState,
  set: SetDefinition,
  tempo: Tempo,
  definition: EnemyDefinition,
  isBoss: boolean,
): void {
  const { x, y } = isBoss
    ? edgePosition(state.rng, state.arena, definition.radius)
    : ruleSpawnPosition(state, set, tempo, definition.radius);
  spawnEnemy(state, definition, x, y, isBoss, perPlayerMul(state, set.perPlayer?.enemyHpMul));
}

// 1 + mul per player beyond the first; 1 when the set does not scale.
function perPlayerMul(state: SimState, mul: number | undefined): number {
  return 1 + (mul ?? 0) * (state.players.length - 1);
}

function scaledCount(state: SimState, set: SetDefinition, count: number): number {
  const scaled = Math.floor(count * perPlayerMul(state, set.perPlayer?.spawnMul) + 0.5);
  return Math.max(count, scaled);
}

function ruleSpawnPosition(
  state: SimState,
  set: SetDefinition,
  tempo: Tempo,
  radius: number,
): Vec2 {
  const sided = set.sidedWaves;
  if (sided === undefined) {
    return edgePosition(state.rng, state.arena, radius);
  }
  const index = Math.floor(barOfTick(state.tick, tempo) / sided.everyBars);
  if (state.spawnWindow?.index !== index) {
    state.spawnWindow = { index, sides: drawSides(state.rng, sided.chance) };
  }
  const { sides } = state.spawnWindow;
  if (sides.length === 0 || nextFloat(state.rng) < sided.randomShare) {
    return edgePosition(state.rng, state.arena, radius);
  }
  return sidePosition(state.rng, state.arena, radius, pick(state.rng, sides));
}

const SIDES: readonly EdgeSide[] = ['top', 'right', 'bottom', 'left'];

function drawSides(rng: SimState['rng'], chance: number): EdgeSide[] {
  if (nextFloat(rng) >= chance) {
    return [];
  }
  const first = pick(rng, SIDES);
  const sides = [first];
  if (nextInt(rng, 2) === 1) {
    sides.push(
      pick(
        rng,
        SIDES.filter((side) => side !== first),
      ),
    );
  }
  return sides;
}

// A point on the edge of the arena, drawn uniformly along its perimeter, as bad vibes spawn.
export function edgePosition(rng: SimState['rng'], arena: Arena, radius: number): Vec2 {
  const [spanX, spanY] = spans(arena, radius);
  return pointAlong(arena, radius, nextFloat(rng) * 2 * (spanX + spanY));
}

function sidePosition(rng: SimState['rng'], arena: Arena, radius: number, side: EdgeSide): Vec2 {
  const [spanX, spanY] = spans(arena, radius);
  const start = { top: 0, right: spanX, bottom: spanX + spanY, left: 2 * spanX + spanY }[side];
  const length = side === 'top' || side === 'bottom' ? spanX : spanY;
  return pointAlong(arena, radius, start + nextFloat(rng) * length);
}

function spans({ width, height }: Arena, radius: number): [number, number] {
  return [width - 2 * radius, height - 2 * radius];
}

// The point `along` the perimeter, clockwise from the top left corner.
function pointAlong(arena: Arena, radius: number, along: number): Vec2 {
  const { width, height } = arena;
  const [spanX, spanY] = spans(arena, radius);
  if (along < spanX) {
    return { x: radius + along, y: radius };
  }
  along -= spanX;
  if (along < spanY) {
    return { x: width - radius, y: radius + along };
  }
  along -= spanY;
  if (along < spanX) {
    return { x: width - radius - along, y: height - radius };
  }
  along -= spanX;
  return { x: radius, y: height - radius - along };
}

import type { EnemyDefinition } from '../../data/types';
import { nextFloat } from '../../shared/prng';
import { BARS_PER_PHRASE, TICKS_PER_BAR, isBarTick } from '../../shared/tempo';
import { lookup } from '../content';
import { compound } from '../effects';
import { volumeMul } from '../volume';
import type { Arena, EnemyState, SimState, Vec2 } from '../state';
import type { StepContext } from './types';

export function spawning({ state, content, set }: StepContext): void {
  for (const event of state.events) {
    if (event.type === 'segment' && event.segment === 'drop') {
      const tier = set.tiers[event.tier];
      if (tier !== undefined) {
        spawnAtEdge(state, lookup(content.enemies, tier.bossId, 'enemy'), true);
      }
    }
  }

  const tier = set.tiers[state.set.tier];
  if (tier === undefined || state.set.segment !== 'buildup' || !isBarTick(state.tick)) {
    return;
  }
  const bar = (state.tick - state.set.segmentStartTick) / TICKS_PER_BAR;
  const phrase = Math.floor(bar / BARS_PER_PHRASE);
  for (const rule of tier.spawns) {
    const active =
      phrase >= rule.fromPhrase && (rule.toPhrase === undefined || phrase <= rule.toPhrase);
    if (!active || bar % rule.everyBars !== 0) {
      continue;
    }
    const definition = lookup(content.enemies, rule.enemyId, 'enemy');
    const count = Math.ceil(rule.count * volumeMul(state));
    for (let i = 0; i < count; i++) {
      spawnAtEdge(state, definition, false);
    }
  }
}

export function spawnEnemy(
  state: SimState,
  definition: EnemyDefinition,
  x: number,
  y: number,
  isBoss: boolean,
): EnemyState {
  const phrase = state.set.phrase;
  const maxHp =
    definition.maxHp * compound(definition.scalingPerPhrase.hp, phrase) * volumeMul(state);
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

function spawnAtEdge(state: SimState, definition: EnemyDefinition, isBoss: boolean): void {
  const { x, y } = edgePosition(state.rng, state.arena, definition.radius);
  spawnEnemy(state, definition, x, y, isBoss);
}

// A point on the edge of the arena, drawn uniformly along its perimeter, as bad vibes spawn.
export function edgePosition(rng: SimState['rng'], arena: Arena, radius: number): Vec2 {
  const { width, height } = arena;
  const spanX = width - 2 * radius;
  const spanY = height - 2 * radius;
  let along = nextFloat(rng) * 2 * (spanX + spanY);
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

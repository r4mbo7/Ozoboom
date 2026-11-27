import type { BystanderDefinition } from '../../data/types';
import { nextFloat } from '../../shared/prng';
import { BARS_PER_PHRASE, isBarTick, type Tempo } from '../../shared/tempo';
import { playerById } from '../damage';
import { lookup, type ResolvedContent } from '../content';
import { segmentMusicTicks } from '../lineup';
import { touches } from '../effects';
import { clearOfObstacles, type Obstacles } from '../obstacles';
import { ashore, type Shore } from '../shore';
import type { BystanderLeaving, BystanderState, SimState } from '../state';
import { reviveMulOf } from './revive';
import { dryEdgePosition } from './spawning';
import type { StepContext } from './types';

const WANDER_FRACTION_MIN = 0.3;
const WANDER_FRACTION_SPAN = 0.4;

export function bystanders(ctx: StepContext): void {
  spawnBystanders(ctx);
  updateBystanders(ctx);
}

function spawnBystanders({ state, content, set, tempo, obstacles, shore }: StepContext): void {
  const tier = set.tiers[state.set.tier];
  if (tier === undefined || state.set.segment !== 'buildup' || !isBarTick(state.tick, tempo)) {
    return;
  }
  const bar = segmentMusicTicks(state.set, state.tick) / tempo.ticksPerBar;
  const phrase = Math.floor(bar / BARS_PER_PHRASE);
  for (const rule of tier.bystanderSpawns ?? []) {
    const active =
      phrase >= rule.fromPhrase && (rule.toPhrase === undefined || phrase <= rule.toPhrase);
    if (!active || bar % rule.everyBars !== 0) {
      continue;
    }
    const definition = lookup(content.bystanders, rule.bystanderId, 'bystander');
    for (let i = 0; i < rule.count; i++) {
      spawnBystander(state, definition, tempo, obstacles, shore);
    }
  }
}

function spawnBystander(
  state: SimState,
  definition: BystanderDefinition,
  tempo: Tempo,
  obstacles: Obstacles,
  shore: Shore | null,
): void {
  const edge = dryEdgePosition(state.rng, state.arena, definition.radius, shore);
  const { x, y } = clearOfObstacles(edge, definition.radius, obstacles);
  const { core } = state;
  const fraction = WANDER_FRACTION_MIN + nextFloat(state.rng) * WANDER_FRACTION_SPAN;
  // Players stay on the shore of a lake: a Festivalier comes from the land and stops there.
  const target = ashore(
    shore,
    { x: x + (core.x - x) * fraction, y: y + (core.y - y) * fraction },
    definition.radius,
  );
  const bystander: BystanderState = {
    id: state.nextEntityId,
    kind: definition.id,
    x,
    y,
    prevX: x,
    prevY: y,
    radius: definition.radius,
    targetX: target.x,
    targetY: target.y,
    helpTicks: 0,
    ticksLeft: definition.lifetimeBars * tempo.ticksPerBar,
  };
  state.nextEntityId += 1;
  (state.bystanders ??= []).push(bystander);
  state.events.push({ type: 'bystanderSpawned', id: bystander.id, kind: bystander.kind, x, y });
}

function updateBystanders(ctx: StepContext): void {
  const { state, content } = ctx;
  const list = state.bystanders;
  if (list === undefined || list.length === 0) {
    return;
  }
  let kept = 0;
  for (const bystander of list) {
    const definition = lookup(content.bystanders, bystander.kind, 'bystander');
    advance(bystander, definition);

    if (touchedByEnemy(state, bystander)) {
      leave(state, bystander, definition.vibesPenalty, 'badVibe');
      continue;
    }

    const aid = aidOf(ctx, bystander);
    if (aid > 0) {
      bystander.helpTicks += aid;
      if (bystander.helpTicks >= definition.helpTicks) {
        help(state, bystander, definition.vibesReward);
        continue;
      }
    } else {
      // Left alone, the help leaks back as fast as one player builds it, like a speaker's charge,
      // and its time runs: it only runs out while nobody helps it.
      bystander.helpTicks = Math.max(0, bystander.helpTicks - 1);
      bystander.ticksLeft -= 1;
      if (bystander.ticksLeft <= 0) {
        leave(state, bystander, 0, 'timeUp');
        continue;
      }
    }

    list[kept] = bystander;
    kept += 1;
  }
  list.length = kept;
}

function advance(bystander: BystanderState, definition: BystanderDefinition): void {
  const dx = bystander.targetX - bystander.x;
  const dy = bystander.targetY - bystander.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= definition.speed) {
    bystander.x = bystander.targetX;
    bystander.y = bystander.targetY;
    return;
  }
  bystander.x += (dx / distance) * definition.speed;
  bystander.y += (dy / distance) * definition.speed;
}

function touchedByEnemy(state: SimState, bystander: BystanderState): boolean {
  for (const enemy of state.enemies) {
    if (enemy.hp > 0 && touches(bystander, enemy, enemy.radius)) {
      return true;
    }
  }
  return false;
}

// A standing player counts their class's reviveMul; a zone heal this tick counts 1.
function aidOf(ctx: StepContext, bystander: BystanderState): number {
  const { state, content } = ctx;
  let aid = 0;
  for (const player of state.players) {
    if (!player.downed && touches(bystander, player, player.radius)) {
      aid = Math.max(aid, reviveMulOf(content, player));
    }
  }
  if (aid > 0) {
    return aid;
  }
  for (const trap of state.traps) {
    const definition = content.traps.get(trap.kind);
    if (definition?.effect.kind === 'mist' && touches(bystander, trap, definition.effect.radius)) {
      return 1;
    }
  }
  for (const zone of state.placed ?? []) {
    if (
      content.weapons.get(zone.weaponId)?.effect.kind === 'plate' &&
      touches(bystander, zone, zone.radius)
    ) {
      return 1;
    }
  }
  return healPulseTouches(state, content, bystander) ? 1 : 0;
}

function healPulseTouches(
  state: SimState,
  content: ResolvedContent,
  bystander: BystanderState,
): boolean {
  for (const event of state.events) {
    if (event.type !== 'skillUsed') {
      continue;
    }
    const caster = playerById(state, event.playerId);
    if (caster === undefined) {
      continue;
    }
    const { effect } = lookup(content.classes, caster.classId, 'class').skill;
    if (effect.kind === 'healPulse' && touches(bystander, caster, effect.radius)) {
      return true;
    }
  }
  return false;
}

function help(state: SimState, bystander: BystanderState, reward: number): void {
  for (const player of state.players) {
    player.vibes += reward;
  }
  state.events.push({
    type: 'bystanderHelped',
    id: bystander.id,
    kind: bystander.kind,
    x: bystander.x,
    y: bystander.y,
  });
}

function leave(
  state: SimState,
  bystander: BystanderState,
  penalty: number,
  reason: BystanderLeaving,
): void {
  for (const player of state.players) {
    player.vibes = Math.max(0, player.vibes - penalty);
  }
  state.events.push({
    type: 'bystanderLost',
    id: bystander.id,
    kind: bystander.kind,
    x: bystander.x,
    y: bystander.y,
    reason,
  });
}

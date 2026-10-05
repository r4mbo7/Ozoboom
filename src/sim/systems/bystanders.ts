import type { BystanderDefinition } from '../../data/types';
import { nextFloat } from '../../shared/prng';
import { BARS_PER_PHRASE, TICKS_PER_BAR, isBarTick } from '../../shared/tempo';
import { playerById } from '../damage';
import { lookup, type ResolvedContent } from '../content';
import { touches } from '../effects';
import type { BystanderState, SimState } from '../state';
import { edgePosition } from './spawning';
import type { StepContext } from './types';

// Where it walks to from its spawn point: a random point roughly halfway to the core.
const WANDER_FRACTION_MIN = 0.3;
const WANDER_FRACTION_SPAN = 0.4;

export function bystanders(ctx: StepContext): void {
  spawnBystanders(ctx);
  updateBystanders(ctx);
}

function spawnBystanders({ state, content, set }: StepContext): void {
  const tier = set.tiers[state.set.tier];
  if (tier === undefined || state.set.segment !== 'buildup' || !isBarTick(state.tick)) {
    return;
  }
  const bar = (state.tick - state.set.segmentStartTick) / TICKS_PER_BAR;
  const phrase = Math.floor(bar / BARS_PER_PHRASE);
  for (const rule of tier.bystanderSpawns ?? []) {
    const active =
      phrase >= rule.fromPhrase && (rule.toPhrase === undefined || phrase <= rule.toPhrase);
    if (!active || bar % rule.everyBars !== 0) {
      continue;
    }
    const definition = lookup(content.bystanders, rule.bystanderId, 'bystander');
    for (let i = 0; i < rule.count; i++) {
      spawnBystander(state, definition);
    }
  }
}

function spawnBystander(state: SimState, definition: BystanderDefinition): void {
  const { x, y } = edgePosition(state.rng, state.arena, definition.radius);
  const { core } = state;
  const fraction = WANDER_FRACTION_MIN + nextFloat(state.rng) * WANDER_FRACTION_SPAN;
  const bystander: BystanderState = {
    id: state.nextEntityId,
    kind: definition.id,
    x,
    y,
    prevX: x,
    prevY: y,
    radius: definition.radius,
    targetX: x + (core.x - x) * fraction,
    targetY: y + (core.y - y) * fraction,
    helpTicks: 0,
    ticksLeft: definition.lifetimeBars * TICKS_PER_BAR,
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
      leave(state, bystander, definition.vibesPenalty);
      continue;
    }

    if (isAided(ctx, bystander)) {
      bystander.helpTicks += 1;
      if (bystander.helpTicks >= definition.helpTicks) {
        help(state, bystander, definition.vibesReward);
        continue;
      }
    } else {
      bystander.helpTicks = 0;
    }

    bystander.ticksLeft -= 1;
    if (bystander.ticksLeft <= 0) {
      leave(state, bystander, 0);
      continue;
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

// A standing, non-downed player, or a zone heal (a trap's mist, a plate, a healPulse cast this tick)
// touching the bystander, counts as a contact.
function isAided(ctx: StepContext, bystander: BystanderState): boolean {
  const { state, content } = ctx;
  for (const player of state.players) {
    if (!player.downed && touches(bystander, player, player.radius)) {
      return true;
    }
  }
  for (const trap of state.traps) {
    const definition = content.traps.get(trap.kind);
    if (definition?.effect.kind === 'mist' && touches(bystander, trap, definition.effect.radius)) {
      return true;
    }
  }
  for (const zone of state.placed ?? []) {
    if (
      content.weapons.get(zone.weaponId)?.effect.kind === 'plate' &&
      touches(bystander, zone, zone.radius)
    ) {
      return true;
    }
  }
  return healPulseTouches(state, content, bystander);
}

function healPulseTouches(
  state: SimState,
  content: ResolvedContent,
  bystander: BystanderState,
): boolean {
  for (const event of state.events) {
    if (event.type !== 'skillUsed' && event.type !== 'ultimateUsed') {
      continue;
    }
    const caster = playerById(state, event.playerId);
    if (caster === undefined) {
      continue;
    }
    const { skill, ultimate } = lookup(content.classes, caster.classId, 'class');
    const effect = event.type === 'skillUsed' ? skill.effect : ultimate.effect;
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

function leave(state: SimState, bystander: BystanderState, penalty: number): void {
  for (const player of state.players) {
    player.vibes = Math.max(0, player.vibes - penalty);
  }
  state.events.push({
    type: 'bystanderLost',
    id: bystander.id,
    kind: bystander.kind,
    x: bystander.x,
    y: bystander.y,
  });
}

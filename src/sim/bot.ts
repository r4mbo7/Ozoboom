import type { ClassDefinition, GameContent } from '../data/types';
import { distanceSquared, length, normalize } from '../shared/vec';
import type { PlayerAction, PlayerCommand } from './commands';
import type { EnemyState, PlayerId, PlayerState, SimState, Vec2 } from './state';

const GUARD_MIN_GAP = 40;
const GUARD_LEASH = 260;
const GUARD_SLACK = 24;
const PICKUP_REACH = 220;
const RANGE_MARGIN = 0.8;

function attackRange(definition: ClassDefinition): number {
  const { projectileSpeed, rangeTicks } = definition.attack;
  return projectileSpeed * rangeTicks * RANGE_MARGIN;
}

function nearest<T extends Vec2>(from: Vec2, candidates: readonly T[]): T | undefined {
  let best: T | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = distanceSquared(candidate, from);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

// The bad vibe nearest to the core that this player covers: allies take the closest ones in turn,
// so a team spreads along the crowd instead of piling on one spot.
function threatFor(
  state: SimState,
  alive: readonly EnemyState[],
  playerId: PlayerId,
): EnemyState | undefined {
  const rank = state.players.filter((ally) => ally.id < playerId && !ally.downed).length;
  const byDistance = alive
    .map((enemy) => ({ enemy, distance: distanceSquared(enemy, state.core) }))
    .sort((a, b) => a.distance - b.distance || a.enemy.id - b.enemy.id);
  return byDistance[rank % Math.max(1, byDistance.length)]?.enemy;
}

function towards(from: Vec2, to: Vec2, stopWithin: number): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return dx * dx + dy * dy <= stopWithin * stopWithin
    ? { x: 0, y: 0 }
    : normalize({ x: dx, y: dy });
}

function chooseCard(
  content: GameContent,
  classId: string,
  options: readonly string[],
): string | undefined {
  const fond = options.find(
    (id) =>
      content.weapons?.find((weapon) => weapon.id === id)?.classAffinity === classId ||
      content.upgrades.find((upgrade) => upgrade.id === id)?.classId === classId,
  );
  return fond ?? options[0];
}

// A deterministic player: shoots the closest bad vibe, holds the ground between the core and the
// crowd at the reach of its class, picks up what is near, helps a downed ally, casts as soon as it
// can and takes the first card of its class. It reads the state only: same seed, same game.
export function botCommand(
  state: SimState,
  content: GameContent,
  playerId: PlayerId,
): PlayerCommand {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) {
    throw new Error(`unknown player ${String(playerId)}`);
  }
  const definition = content.classes.find((candidate) => candidate.id === player.classId);
  if (definition === undefined) {
    throw new Error(`unknown class ${player.classId}`);
  }
  const alive = state.enemies.filter((enemy) => enemy.hp > 0);
  const target = nearest(player, alive);
  const threat = threatFor(state, alive, playerId);
  const offer = state.pendingUpgrades.find((pending) => pending.playerId === playerId);
  const cardId =
    offer === undefined ? undefined : chooseCard(content, player.classId, offer.options);
  const actions: PlayerAction[] =
    cardId === undefined ? [] : [{ type: 'chooseUpgrade', upgradeId: cardId }];
  const standing = !player.downed;
  return {
    playerId,
    input: {
      move: standing ? moveOf(state, player, threat, attackRange(definition)) : { x: 0, y: 0 },
      aim:
        target === undefined
          ? player.aim
          : normalize({ x: target.x - player.x, y: target.y - player.y }),
      fire: standing && target !== undefined,
      skill: standing && target !== undefined && player.skillCooldown === 0,
    },
    actions,
  };
}

function moveOf(
  state: SimState,
  player: PlayerState,
  threat: EnemyState | undefined,
  reach: number,
): Vec2 {
  const downed = nearest(
    player,
    state.players.filter((ally) => ally.downed),
  );
  if (downed !== undefined) {
    return towards(player, downed, player.radius);
  }
  const pickup = nearest(player, state.pickups);
  if (pickup !== undefined && distanceSquared(pickup, player) <= PICKUP_REACH * PICKUP_REACH) {
    return towards(player, pickup, 4);
  }
  const { core } = state;
  if (threat === undefined) {
    return towards(player, core, core.radius + GUARD_MIN_GAP);
  }
  const toThreat = { x: threat.x - core.x, y: threat.y - core.y };
  const gap = Math.min(
    core.radius + GUARD_LEASH,
    Math.max(core.radius + GUARD_MIN_GAP, length(toThreat) - reach),
  );
  const away = normalize(toThreat);
  return towards(player, { x: core.x + away.x * gap, y: core.y + away.y * gap }, GUARD_SLACK);
}

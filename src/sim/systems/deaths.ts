import { clamp } from '../../shared/scalar';
import { lookup } from '../content';
import { playerById } from '../damage';
import { drawRelics } from '../draw';
import { recruitFallen } from '../recruits';
import { ashore } from '../shore';
import { SPECIALS } from '../specials';
import type { EnemyState, PickupKind, SimState, Vec2 } from '../state';
import { dropBattery } from './battery';
import { dropPotion } from './potion';
import { dropBomb } from './bomb';
import { dropDie } from './dice';
import { dropBossTrap, dropCarriedTrap } from './carriers';
import { unmaskFallen } from './dancers';
import { tallyOf } from '../tally';
import { dropTwinVibes, vibesDoubled } from './twin-vibes';
import { bossLeft, isLastTier } from './set-progress';
import type { StepContext } from './types';

const DROP_SPACING = 40;
const TWIN_GAP = 7;
// The widest of a drop's radii: a bomb, the twin vibes, a battery.
const DRY_GAP = 20;

export function deaths(ctx: StepContext): void {
  const { state, content, set } = ctx;
  let kept = 0;
  let bossFell = false;
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      state.enemies[kept] = enemy;
      kept += 1;
      continue;
    }
    if (enemy.escaped === true) {
      state.events.push({
        type: 'enemyFled',
        id: enemy.id,
        kind: enemy.kind,
        x: enemy.x,
        y: enemy.y,
      });
      continue;
    }
    const definition = lookup(content.enemies, enemy.kind, 'enemy');
    if (definition.special?.kind === 'revive') {
      SPECIALS.revive(ctx, enemy, definition.special);
      if (enemy.hp > 0 || enemy.downTicks !== undefined) {
        state.enemies[kept] = enemy;
        kept += 1;
        continue;
      }
    }
    const base = enemy.isBoss ? set.tiers[state.set.tier]?.boss.vibesDrop : undefined;
    const vibesDrop = (base ?? definition.vibesDrop) + (enemy.carrying ?? 0);
    state.events.push({
      type: 'enemyDied',
      id: enemy.id,
      kind: enemy.kind,
      x: enemy.x,
      y: enemy.y,
      byPlayer: enemy.lastHitBy ?? null,
    });
    state.stats.kills += 1;
    const killer = enemy.lastHitBy === undefined ? undefined : playerById(state, enemy.lastHitBy);
    if (killer !== undefined) {
      const tally = tallyOf(killer);
      tally.badVibes += 1;
      if (enemy.isBoss) {
        tally.bosses += 1;
      }
    }
    if (enemy.called === true) {
      state.stats.calledDown = (state.stats.calledDown ?? 0) + 1;
    }
    if (!unmaskFallen(ctx, enemy, definition)) {
      recruitFallen(ctx, enemy, definition);
    }
    bossFell ||= enemy.isBoss;
    dropCarriedTrap(ctx, enemy);
    // What a bad vibe drops in the lake washes up on the shore, where players walk.
    const at = ashore(ctx.shore, enemy, DRY_GAP);
    if (enemy.carriesBomb === true) {
      dropBomb(ctx, at.x, at.y);
    }
    if (enemy.carriesTwinVibes === true) {
      dropTwinVibes(ctx, at.x, at.y);
    }
    if (enemy.carriesBattery === true) {
      dropBattery(ctx, at.x, at.y);
    }
    if (enemy.carriesPotion === true) {
      dropPotion(ctx, at.x, at.y);
    }
    if (enemy.isBoss) {
      dropBossRows(ctx, enemy, at);
    }
    if (vibesDrop > 0) {
      dropVibes(state, vibesDrop, at, set.pickups.lifetimeTicks);
    }
  }
  state.enemies.length = kept;
  // The relics wait for the last boss of the drop, called ones included.
  if (bossFell && !bossLeft(state) && !isLastTier(state.set, set)) {
    offerRelics(ctx);
  }
}

// A placed trap and a die per player, in two rows under the boss, kept whole inside the arena.
function dropBossRows(ctx: StepContext, boss: EnemyState, at: Vec2): void {
  const { width, height } = ctx.state.arena;
  const players = ctx.state.players;
  const half = ((players.length - 1) / 2) * DROP_SPACING;
  const margin = DROP_SPACING / 2;
  const y = clamp(at.y, margin, height - margin);
  const dieY = y + DROP_SPACING <= height - margin ? y + DROP_SPACING : y - DROP_SPACING;
  // The rows run east from their west end: it starts on the shore of a lake, where players walk.
  const west = Math.max(
    at.x - half,
    ashore(ctx.shore, { x: at.x - half, y }, DRY_GAP).x,
    ashore(ctx.shore, { x: at.x - half, y: dieY }, DRY_GAP).x,
  );
  const left = clamp(west, margin, width - margin - 2 * half);
  players.forEach((player, index) => {
    const x = left + index * DROP_SPACING;
    dropBossTrap(ctx, player.id, { x, y });
    dropDie(ctx, x, dieY, boss);
  });
}

function offerRelics({ state, content }: StepContext): void {
  for (const player of state.players) {
    if (player.gone === true) {
      continue;
    }
    const options = drawRelics(state.rng, content, player);
    if (options.length > 0) {
      const rarities = options.map(() => 'common' as const);
      state.pendingUpgrades.push({ playerId: player.id, options, rarities, kind: 'relic' });
      state.events.push({ type: 'relicOffered', playerId: player.id, options });
    }
  }
}

// Doubled, they fall as a pair side by side, each the whole drop.
function dropVibes(state: SimState, amount: number, at: Vec2, ticksLeft: number): void {
  if (!vibesDoubled(state)) {
    drop(state, 'vibes', amount, at.x, at.y, ticksLeft);
    return;
  }
  drop(state, 'vibes', amount, at.x - TWIN_GAP, at.y, ticksLeft);
  drop(state, 'vibes', amount, at.x + TWIN_GAP, at.y, ticksLeft);
}

function drop(
  state: SimState,
  kind: PickupKind,
  amount: number,
  x: number,
  y: number,
  ticksLeft: number,
): void {
  state.pickups.push({
    id: state.nextEntityId,
    kind,
    amount,
    x,
    y,
    prevX: x,
    prevY: y,
    ticksLeft,
  });
  state.nextEntityId += 1;
}

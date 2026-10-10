import type { TrapDefinition } from '../../data/types';
import { type RngState, nextFloat } from '../../shared/prng';
import { barOfTick, isBarTick } from '../../shared/tempo';
import { touches } from '../effects';
import { statValue } from '../stats';
import type { StepContext } from './types';

// Every `everyBars` bars, fewer with the talkie-walkie of any player, a loot falls due; the first
// bad vibe to spawn from then on, boss aside, carries it.
export function lootCarriers({ state, set, tempo }: StepContext): void {
  const rules = set.loot;
  if (rules === undefined) {
    return;
  }
  const bar = barOfTick(state.tick, tempo);
  const interval = Math.max(
    1,
    Math.ceil(
      state.players.reduce(
        (bars, player) => statValue(player, 'lootIntervalMul', bars),
        rules.everyBars,
      ),
    ),
  );
  if (isBarTick(state.tick, tempo) && bar >= (state.nextLootBar ?? interval)) {
    state.lootDue = true;
    state.nextLootBar = bar + interval;
  }
  if (state.lootDue !== true) {
    return;
  }
  for (const event of state.events) {
    const enemy =
      event.type === 'enemySpawned' ? state.enemies.find(({ id }) => id === event.id) : undefined;
    if (enemy !== undefined && !enemy.isBoss) {
      enemy.carriesLoot = true;
      state.lootDue = false;
      return;
    }
  }
}

export function dropLoot({ state, content, set, tempo }: StepContext, x: number, y: number): void {
  const rules = set.loot;
  if (rules === undefined) {
    return;
  }
  const dropped = state.lootsDropped ?? 0;
  const trapId = dropped === 0 ? rules.first : drawLootTrap(state.rng, [...content.traps.values()]);
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  const ticksLeft = rules.lifetimeBars * tempo.ticksPerBar;
  (state.loots ??= []).push({ id, trapId, ticksLeft, x, y, prevX: x, prevY: y });
  state.lootsDropped = dropped + 1;
  state.events.push({ type: 'lootDropped', id, trapId, x, y });
}

export function drawLootTrap(
  rng: RngState,
  traps: readonly Pick<TrapDefinition, 'id' | 'lootWeight'>[],
): string {
  const total = traps.reduce((sum, trap) => sum + trap.lootWeight, 0);
  let roll = nextFloat(rng) * total;
  for (const trap of traps) {
    roll -= trap.lootWeight;
    if (roll < 0) {
      return trap.id;
    }
  }
  const last = traps.at(-1);
  if (last === undefined) {
    throw new Error('A loot needs at least one trap');
  }
  return last.id;
}

// A loot goes to the first player standing on it with a free hand, or fades away.
export function loots({ state, set }: StepContext): void {
  const rules = set.loot;
  const lying = state.loots;
  if (rules === undefined || lying === undefined) {
    return;
  }
  let kept = 0;
  for (const loot of lying) {
    const taker = state.players.find(
      (player) =>
        !player.downed &&
        (player.hand?.length ?? 0) < set.handSize &&
        touches(player, loot, statValue(player, 'lootRadiusMul', rules.radius)),
    );
    if (taker !== undefined) {
      (taker.hand ??= []).push({ trapId: loot.trapId });
      const { id, trapId, x, y } = loot;
      state.events.push({ type: 'lootCollected', id, playerId: taker.id, trapId, x, y });
      continue;
    }
    loot.ticksLeft -= 1;
    if (loot.ticksLeft > 0) {
      lying[kept] = loot;
      kept += 1;
    }
  }
  lying.length = kept;
}

import type { LootDraw, TrapDefinition } from '../../data/types';
import { type RngState, nextFloat } from '../../shared/prng';
import { barOfTick, isBarTick } from '../../shared/tempo';
import { touches } from '../effects';
import type { PlayerState, SimState } from '../state';
import { handFree, statValue } from '../stats';
import type { StepContext } from './types';

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
  const draw = state.lootDraw;
  const trapId =
    dropped === 0
      ? (draw?.first ?? rules.first)
      : drawLootTrap(state.rng, lootOdds([...content.traps.values()], draw));
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  const ticksLeft = rules.lifetimeBars * tempo.ticksPerBar;
  (state.loots ??= []).push({ id, trapId, ticksLeft, x, y, prevX: x, prevY: y });
  state.lootsDropped = dropped + 1;
  state.events.push({ type: 'lootDropped', id, trapId, x, y });
}

// The last trap of the hand, under the player, to free a hand.
export function layDownTrap(state: SimState, player: PlayerState): boolean {
  const trapId = player.hand?.pop();
  if (trapId === undefined) {
    return false;
  }
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  const { x, y } = player;
  (state.loots ??= []).push({ id, trapId, x, y, prevX: x, prevY: y });
  state.events.push({ type: 'lootDropped', id, trapId, x, y });
  return true;
}

function lootOdds(
  traps: readonly TrapDefinition[],
  draw: LootDraw | undefined,
): readonly Pick<TrapDefinition, 'id' | 'lootWeight'>[] {
  if (draw === undefined) {
    return traps;
  }
  return traps.map(({ id }) => ({ id, lootWeight: draw.weights[id] ?? 0 }));
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
        handFree(player, set) &&
        touches(player, loot, statValue(player, 'lootRadiusMul', rules.radius)),
    );
    if (taker !== undefined) {
      (taker.hand ??= []).push(loot.trapId);
      const { id, trapId, x, y } = loot;
      state.events.push({ type: 'lootCollected', id, playerId: taker.id, trapId, x, y });
      continue;
    }
    if (loot.ticksLeft !== undefined) {
      loot.ticksLeft -= 1;
    }
    if (loot.ticksLeft === undefined || loot.ticksLeft > 0) {
      lying[kept] = loot;
      kept += 1;
    }
  }
  lying.length = kept;
}

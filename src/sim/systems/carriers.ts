import type { TrapDefinition, TrapDraw } from '../../data/types';
import { type RngState, nextFloat } from '../../shared/prng';
import { barOfTick, isBarTick } from '../../shared/tempo';
import type { EnemyState, PlayerId, Vec2 } from '../state';
import { statValue } from '../stats';
import { dropTrap } from '../trap-moves';
import type { StepContext } from './types';

export function trapCarriers(ctx: StepContext): void {
  const { state, set, tempo } = ctx;
  const rules = set.carriers;
  if (rules === undefined) {
    return;
  }
  const bar = barOfTick(state.tick, tempo);
  // Each Volume level and each Talkie-walkie brings them more often.
  const bars = state.players.reduce(
    (every, player) => statValue(player, 'carrierIntervalMul', every),
    rules.everyBars / (1 + rules.frequencyPerVolume * (state.volume ?? 0)),
  );
  const interval = Math.max(1, Math.ceil(bars));
  if (isBarTick(state.tick, tempo) && bar >= (state.nextCarrierBar ?? interval)) {
    state.carrierDue = true;
    state.nextCarrierBar = bar + interval;
  }
  if (state.carrierDue !== true) {
    return;
  }
  for (const event of state.events) {
    const enemy =
      event.type === 'enemySpawned' ? state.enemies.find(({ id }) => id === event.id) : undefined;
    if (enemy !== undefined && !enemy.isBoss) {
      enemy.carriesTrap = drawCarriedTrap(ctx);
      state.carrierDue = false;
      return;
    }
  }
}

// Killed by no one, it drops its trap in the first player's name.
export function dropCarriedTrap(ctx: StepContext, enemy: EnemyState): void {
  const owner = enemy.lastHitBy ?? ctx.state.players[0]?.id;
  if (enemy.carriesTrap !== undefined && owner !== undefined) {
    dropTrap(ctx, enemy.carriesTrap, owner, enemy);
  }
}

// One of a boss's traps, in that player's name.
export function dropBossTrap(ctx: StepContext, playerId: PlayerId, at: Vec2): void {
  if (ctx.set.carriers !== undefined) {
    dropTrap(ctx, drawCarriedTrap(ctx), playerId, at);
  }
}

function drawCarriedTrap({ state, content, set }: StepContext): string {
  const drawn = state.trapsDrawn ?? 0;
  state.trapsDrawn = drawn + 1;
  const draw = state.trapDraw;
  if (drawn === 0) {
    const first = draw?.first ?? set.carriers?.first;
    if (first !== undefined) {
      return first;
    }
  }
  return drawTrap(state.rng, trapOdds([...content.traps.values()], draw));
}

function trapOdds(
  traps: readonly TrapDefinition[],
  draw: TrapDraw | undefined,
): readonly Pick<TrapDefinition, 'id' | 'carrierWeight'>[] {
  if (draw === undefined) {
    return traps;
  }
  return traps.map(({ id }) => ({ id, carrierWeight: draw.weights[id] ?? 0 }));
}

export function drawTrap(
  rng: RngState,
  traps: readonly Pick<TrapDefinition, 'id' | 'carrierWeight'>[],
): string {
  const total = traps.reduce((sum, trap) => sum + trap.carrierWeight, 0);
  let roll = nextFloat(rng) * total;
  for (const trap of traps) {
    roll -= trap.carrierWeight;
    if (roll < 0) {
      return trap.id;
    }
  }
  const last = traps.at(-1);
  if (last === undefined) {
    throw new Error('A carrier needs at least one trap');
  }
  return last.id;
}

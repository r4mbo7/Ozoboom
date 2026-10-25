import { barOfTick, isBarTick } from '../../shared/tempo';
import { lookup } from '../content';
import { hurtEnemy, touches } from '../effects';
import type { StepContext } from './types';

export function bombCarriers({ state, set, tempo }: StepContext): void {
  const rules = set.bomb;
  if (rules === undefined) {
    return;
  }
  const bar = barOfTick(state.tick, tempo);
  if (isBarTick(state.tick, tempo) && bar >= (state.nextBombBar ?? rules.everyBars)) {
    state.bombDue = true;
    state.nextBombBar = bar + rules.everyBars;
  }
  if (state.bombDue !== true) {
    return;
  }
  for (const event of state.events) {
    const enemy =
      event.type === 'enemySpawned' ? state.enemies.find(({ id }) => id === event.id) : undefined;
    if (enemy !== undefined && !enemy.isBoss && enemy.carriesLoot !== true) {
      enemy.carriesBomb = true;
      state.bombDue = false;
      return;
    }
  }
}

export function dropBomb({ state, set, tempo }: StepContext, x: number, y: number): void {
  const rules = set.bomb;
  if (rules === undefined) {
    return;
  }
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  const ticksLeft = rules.lifetimeBars * tempo.ticksPerBar;
  (state.bombs ??= []).push({ id, ticksLeft, x, y, prevX: x, prevY: y });
  state.events.push({ type: 'bombDropped', id, x, y });
}

// A zombie, standing or down, loses its revives: it dies for good.
export function bombs({ state, content, set }: StepContext): void {
  const rules = set.bomb;
  const lying = state.bombs;
  if (rules === undefined || lying === undefined) {
    return;
  }
  let kept = 0;
  for (const bomb of lying) {
    const trigger = state.players.find(
      (player) => !player.downed && touches(player, bomb, rules.radius),
    );
    if (trigger !== undefined) {
      for (const enemy of state.enemies) {
        if (enemy.isBoss) {
          continue;
        }
        if (lookup(content.enemies, enemy.kind, 'enemy').special?.kind === 'revive') {
          enemy.revivesLeft = 0;
        }
        if (enemy.downTicks === undefined) {
          hurtEnemy(state, enemy, enemy.hp, 1, trigger.id, null);
        } else {
          delete enemy.downTicks;
          enemy.lastHitBy = trigger.id;
        }
      }
      const { id, x, y } = bomb;
      state.events.push({ type: 'bombExploded', id, playerId: trigger.id, x, y });
      continue;
    }
    bomb.ticksLeft -= 1;
    if (bomb.ticksLeft > 0) {
      lying[kept] = bomb;
      kept += 1;
    }
  }
  lying.length = kept;
}

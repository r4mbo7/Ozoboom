import { barOfTick, isBarTick } from '../../shared/tempo';
import { lookup } from '../content';
import { hurtEnemy, touches } from '../effects';
import { freeCarrier } from './stage-bonus';
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
  const carrier = freeCarrier(state);
  if (carrier !== undefined) {
    carrier.carriesBomb = true;
    state.bombDue = false;
  }
}

export function dropBomb({ state, set }: StepContext, x: number, y: number): void {
  const rules = set.bomb;
  if (rules === undefined) {
    return;
  }
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  (state.bombs ??= []).push({ id, x, y, prevX: x, prevY: y });
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
      (player) => !player.downed && player.gone !== true && touches(player, bomb, rules.radius),
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
          hurtEnemy(state, enemy, enemy.hp, trigger.id, null);
        } else {
          delete enemy.downTicks;
          enemy.lastHitBy = trigger.id;
        }
      }
      const { id, x, y } = bomb;
      state.events.push({ type: 'bombExploded', id, playerId: trigger.id, x, y });
      continue;
    }
    lying[kept] = bomb;
    kept += 1;
  }
  lying.length = kept;
}

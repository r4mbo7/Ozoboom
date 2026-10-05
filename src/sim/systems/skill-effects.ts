import { isBeatTick } from '../../shared/tempo';
import { hurtEnemy, keepWhere, markedDamageMul, pushAway, touches } from '../effects';
import type { BarrierState, SimState } from '../state';
import type { StepContext } from './types';

export function skillEffects({ state, content }: StepContext): void {
  const markedMul = markedDamageMul(content);
  const { laserShows = [], barriers = [] } = state;
  for (const show of laserShows) {
    const caster = state.players.find((player) => player.id === show.playerId);
    if (caster === undefined) {
      throw new Error(`laser show ${String(show.id)} has no caster ${String(show.playerId)}`);
    }
    for (const enemy of state.enemies) {
      if (enemy.hp > 0 && touches(enemy, caster, show.radius)) {
        hurtEnemy(state, enemy, show.damagePerTick, markedMul, show.playerId);
      }
    }
    show.ticksLeft -= 1;
  }
  for (const barrier of barriers) {
    holdBack(state, barrier);
    barrier.ticksLeft -= 1;
  }
  for (const barrier of barriers) {
    if (barrier.hp <= 0) {
      state.events.push({ type: 'barrierBroken', id: barrier.id, x: barrier.x, y: barrier.y });
    }
  }
  keepWhere(laserShows, (show) => show.ticksLeft > 0);
  keepWhere(barriers, (barrier) => barrier.ticksLeft > 0 && barrier.hp > 0);
}

function holdBack(state: SimState, barrier: BarrierState): void {
  const onBeat = isBeatTick(state.tick);
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || !touches(enemy, barrier, barrier.radius)) {
      continue;
    }
    const dx = enemy.x - barrier.x;
    const dy = enemy.y - barrier.y;
    const gap = barrier.radius + enemy.radius - Math.sqrt(dx * dx + dy * dy);
    if (gap <= 0) {
      continue;
    }
    pushAway(enemy, barrier, gap);
    if (onBeat) {
      barrier.hp -= enemy.damage;
    }
  }
}

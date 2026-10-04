import { playerById } from '../damage';
import { pushAway, touches } from '../effects';
import type { SpecialModule } from './types';

export const shove: SpecialModule = (ctx, enemy, effect) => {
  if (effect.kind !== 'shove' || enemy.target === 'core') {
    return;
  }
  const { state } = ctx;
  const player = playerById(state, enemy.target);
  if (player === undefined || player.downed || !touches(player, enemy, enemy.radius)) {
    return;
  }
  pushAway(player, enemy, effect.knockback);
  const { width, height } = state.arena;
  player.x = clamp(player.x, player.radius, width - player.radius);
  player.y = clamp(player.y, player.radius, height - player.radius);
  state.events.push({
    type: 'playerShoved',
    id: enemy.id,
    kind: enemy.kind,
    playerId: player.id,
    x: enemy.x,
    y: enemy.y,
  });
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

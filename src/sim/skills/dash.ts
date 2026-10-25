import { clamp } from '../../shared/scalar';
import { normalize } from '../../shared/vec';
import { touches } from '../effects';
import { freeShare } from '../obstacles';
import type { PlayerState, SimState } from '../state';
import type { SkillModule, SkillOf } from './types';

export const dash: SkillModule<SkillOf<'dash'>> = {
  cast({ state, set }, player, effect, input, power) {
    const move = normalize(input.move);
    const direction = move.x === 0 && move.y === 0 ? player.aim : move;
    const distance = effect.distance * power;
    const { width, height } = state.arena;
    const x = clamp(player.x + direction.x * distance, player.radius, width - player.radius);
    const y = clamp(player.y + direction.y * distance, player.radius, height - player.radius);
    // The charge stops at the first obstacle in its way rather than leaping it.
    const share = freeShare(player.x, player.y, x, y, player.radius, set.obstacles ?? []);
    player.x += (x - player.x) * share;
    player.y += (y - player.y) * share;
    player.invulnerableTicks = Math.max(player.invulnerableTicks ?? 0, effect.invulnerableTicks);
    if (effect.tauntRadius !== undefined) {
      taunt(state, player, effect.tauntRadius);
    }
  },
};

function taunt(state: SimState, player: PlayerState, radius: number): void {
  let count = 0;
  for (const enemy of state.enemies) {
    if (enemy.hp > 0 && touches(enemy, player, radius)) {
      enemy.target = player.id;
      count += 1;
    }
  }
  state.events.push({
    type: 'taunted',
    playerId: player.id,
    x: player.x,
    y: player.y,
    radius,
    count,
  });
}

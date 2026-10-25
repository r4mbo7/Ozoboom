import type { AuraAttack } from '../../data/kiffeur';
import { angleOf } from '../../shared/angle';
import { isBeatTick } from '../../shared/tempo';
import type { AttackModule, Upgraded } from './types';
import { hurtEnemy, markedDamageMul, touches } from '../effects';
import { gaugeValue } from '../gauges';
import type { PlayerState } from '../state';
import { statValue } from '../stats';

export const aura: AttackModule<AuraAttack> = {
  step(ctx, player, attack) {
    const { state, tempo } = ctx;
    if (!isBeatTick(state.tick, tempo)) {
      return;
    }
    const radius = auraRadius(player, attack);
    const notches = Math.floor(gaugeValue(player));
    const damage =
      statValue(player, 'damageMul', attack.damage) *
      (1 + notches * statValue(player, 'kiffDamageAdd', 0));
    const markedMul = markedDamageMul(ctx.content);
    const from = { x: player.x, y: player.y };
    let hit = false;
    for (const enemy of state.enemies) {
      if (enemy.hp > 0 && touches(enemy, player, radius)) {
        hurtEnemy(state, enemy, damage, markedMul, player.id, from);
        hit = true;
      }
    }
    if (hit) {
      state.events.push({
        type: 'playerFired',
        playerId: player.id,
        x: player.x,
        y: player.y,
        angle: angleOf(player.aim),
      });
    }
  },

  reach(attack, player) {
    return statValue(player, 'attackRadiusMul', attack.radius);
  },
};

export function auraRadius(
  player: Upgraded & Pick<PlayerState, 'gauge'>,
  attack: AuraAttack,
): number {
  const notches = Math.floor(gaugeValue(player));
  return statValue(player, 'attackRadiusMul', attack.radius + notches * attack.kiff.radiusPerNotch);
}

import type { AuraAttack } from '../../data/kiffeur';
import { angleOf } from '../../shared/angle';
import { beatOfTick, isBeatTick, isOffbeatTick, type Tempo } from '../../shared/tempo';
import { distanceSquared } from '../../shared/vec';
import type { AttackModule, Upgraded } from './types';
import { hurtEnemy, markedDamageMul, touches } from '../effects';
import { gaugeValue } from '../gauges';
import type { EnemyState, PlayerState } from '../state';
import { statValue } from '../stats';

export const aura: AttackModule<AuraAttack> = {
  reads: [
    'attackCooldownMul',
    'attackRadiusMul',
    'damageMul',
    'kiffDamageAdd',
    'pierceAdd',
    'projectileCountAdd',
    'projectileSpeedMul',
  ],

  step(ctx, player, attack) {
    const { state, tempo } = ctx;
    if (!pulsesOn(player, state.tick, tempo)) {
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
    for (const enemy of spilledOn(state.enemies, player, attack, radius)) {
      hurtEnemy(state, enemy, damage, markedMul, player.id, from);
      state.events.push({
        type: 'moodSpilled',
        playerId: player.id,
        id: enemy.id,
        x: enemy.x,
        y: enemy.y,
      });
      hit = true;
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

// A faster cooldown slips a pulse on the offbeat of some beats, of every beat at twice the rate.
export function pulsesOffbeat(player: Upgraded, beat: number): boolean {
  const extra = Math.min(1, Math.max(0, 1 / statValue(player, 'attackCooldownMul', 1) - 1));
  return Math.floor((beat + 1) * extra) > Math.floor(beat * extra);
}

function pulsesOn(player: Upgraded, tick: number, tempo: Tempo): boolean {
  return (
    isBeatTick(tick, tempo) ||
    (isOffbeatTick(tick, tempo) && pulsesOffbeat(player, beatOfTick(tick, tempo)))
  );
}

// Each extra shot and each pierce spills the good mood onto one more bad vibe past the rim, the
// closest first; faster shots carry it further.
function spilledOn(
  enemies: readonly EnemyState[],
  player: PlayerState,
  attack: AuraAttack,
  radius: number,
): EnemyState[] {
  const count =
    Math.floor(statValue(player, 'projectileCountAdd', 0)) +
    Math.floor(statValue(player, 'pierceAdd', 0));
  if (count <= 0) {
    return [];
  }
  const reach = radius + statValue(player, 'projectileSpeedMul', attack.overflow);
  return enemies
    .filter(
      (enemy) => enemy.hp > 0 && !touches(enemy, player, radius) && touches(enemy, player, reach),
    )
    .map((enemy) => ({ enemy, gap: distanceSquared(enemy, player) }))
    .sort((a, b) => a.gap - b.gap || a.enemy.id - b.enemy.id)
    .slice(0, count)
    .map(({ enemy }) => enemy);
}

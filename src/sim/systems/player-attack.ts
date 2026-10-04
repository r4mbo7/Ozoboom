import { angleOf, rotate } from '../../shared/angle';
import { IDLE_INPUT } from '../commands';
import { lookup } from '../content';
import type { PlayerState, SimState, Vec2 } from '../state';
import type { StepContext } from './types';

export function playerAttack({ state, content, commands }: StepContext): void {
  for (const player of state.players) {
    if (player.downed) {
      continue;
    }
    if (player.attackCooldown > 0) {
      player.attackCooldown -= 1;
    }
    const input = commands.get(player.id)?.input ?? IDLE_INPUT;
    if (!input.fire || player.attackCooldown > 0) {
      player.attackCooldown = Math.max(0, player.attackCooldown);
      continue;
    }
    const attack = lookup(content.classes, player.classId, 'class').attack;
    const { modifiers } = player;
    const count = Math.max(1, Math.floor(attack.count + (modifiers.projectileCountAdd ?? 0)));
    const shot: Shot = {
      speed: attack.projectileSpeed * (modifiers.projectileSpeedMul ?? 1),
      radius: attack.projectileRadius,
      damage: attack.damage * (modifiers.damageMul ?? 1),
      ticks: attack.rangeTicks,
      pierce: attack.pierce + (modifiers.pierceAdd ?? 0),
    };
    for (let i = 0; i < count; i++) {
      const offset =
        count === 1 ? 0 : -attack.spreadRadians / 2 + (i * attack.spreadRadians) / (count - 1);
      fire(state, player, offset === 0 ? player.aim : rotate(player.aim, offset), shot);
    }
    // The fractional part of a shortened cooldown carries over, so the fire rate stays exact.
    player.attackCooldown += attack.cooldownTicks * (modifiers.attackCooldownMul ?? 1);
    state.events.push({
      type: 'playerFired',
      playerId: player.id,
      x: player.x,
      y: player.y,
      angle: angleOf(player.aim),
    });
  }
}

interface Shot {
  speed: number;
  radius: number;
  damage: number;
  ticks: number;
  pierce: number;
}

function fire(state: SimState, player: PlayerState, direction: Vec2, shot: Shot): void {
  state.projectiles.push({
    id: state.nextEntityId,
    owner: { kind: 'player', playerId: player.id },
    x: player.x,
    y: player.y,
    prevX: player.x,
    prevY: player.y,
    vx: direction.x * shot.speed,
    vy: direction.y * shot.speed,
    radius: shot.radius,
    damage: shot.damage,
    ticksLeft: shot.ticks,
    pierceLeft: shot.pierce,
  });
  state.nextEntityId += 1;
}

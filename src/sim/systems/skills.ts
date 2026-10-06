import type { SkillEffect } from '../../data/types';
import { normalize } from '../../shared/vec';
import { IDLE_INPUT, type PlayerInput } from '../commands';
import { lookup } from '../content';
import { healPlayer, hurtEnemy, markedDamageMul, knockBack, touches } from '../effects';
import type { PlayerState, SimState } from '../state';
import { skillCooldownTicks, statValue } from '../stats';
import type { StepContext } from './types';

export function skills({ state, content, set, commands }: StepContext): void {
  if (state.events.some((event) => event.type === 'bar')) {
    delete state.core.repairedThisBar;
  }
  const dropStarted = state.events.some(
    (event) => event.type === 'segment' && event.segment === 'drop',
  );
  const markedMul = markedDamageMul(content);
  for (const player of state.players) {
    player.skillCooldown = Math.max(0, player.skillCooldown - 1);
    player.invulnerableTicks = Math.max(0, (player.invulnerableTicks ?? 0) - 1);
    player.ultimateReady = dropStarted || (player.ultimateReady && state.set.segment === 'drop');
    if (player.downed) {
      continue;
    }
    const input = commands.get(player.id)?.input ?? IDLE_INPUT;
    const { skill, ultimate } = lookup(content.classes, player.classId, 'class');

    if (input.skill && player.skillCooldown === 0) {
      const power = statValue(player, 'skillPowerMul', 1);
      cast(state, player, input, skill.effect, power, markedMul, set.coreRepairPerBar);
      player.skillCooldown = skillCooldownTicks(player, skill);
      state.events.push({ type: 'skillUsed', playerId: player.id });
    }
    if (input.ultimate && player.ultimateReady) {
      cast(state, player, input, ultimate.effect, 1, markedMul, set.coreRepairPerBar);
      player.ultimateReady = false;
      state.events.push({ type: 'ultimateUsed', playerId: player.id });
    }
  }
}

function cast(
  state: SimState,
  player: PlayerState,
  input: PlayerInput,
  effect: SkillEffect,
  power: number,
  markedMul: number,
  repairCap: number | undefined,
): void {
  switch (effect.kind) {
    case 'nova':
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && touches(enemy, player, effect.radius)) {
          hurtEnemy(state, enemy, effect.damage * power, markedMul, player.id);
          knockBack(enemy, player, effect.knockback);
        }
      }
      return;
    case 'laserShow':
      (state.laserShows ??= []).push({
        id: takeId(state),
        playerId: player.id,
        damagePerTick: effect.damagePerTick * power,
        radius: effect.radius,
        ticksLeft: effect.durationTicks,
      });
      return;
    case 'dash': {
      const move = normalize(input.move);
      const direction = move.x === 0 && move.y === 0 ? player.aim : move;
      const distance = effect.distance * power;
      const { width, height } = state.arena;
      player.x = clamp(player.x + direction.x * distance, player.radius, width - player.radius);
      player.y = clamp(player.y + direction.y * distance, player.radius, height - player.radius);
      player.invulnerableTicks = Math.max(player.invulnerableTicks ?? 0, effect.invulnerableTicks);
      if (effect.tauntRadius !== undefined) {
        taunt(state, player, effect.tauntRadius);
      }
      return;
    }
    case 'barrier':
      (state.barriers ??= []).push({
        id: takeId(state),
        playerId: player.id,
        x: player.x,
        y: player.y,
        radius: effect.radius,
        hp: effect.hp * power,
        ticksLeft: effect.durationTicks,
      });
      return;
    case 'healPulse': {
      for (const ally of state.players) {
        if (!touches(ally, player, effect.radius)) {
          continue;
        }
        if (!ally.downed) {
          healPlayer(state, ally, effect.amount * power);
        } else if (effect.revive === true) {
          ally.downed = false;
          ally.hp = ally.maxHp / 2;
          state.events.push({ type: 'playerRevived', playerId: ally.id });
        }
      }
      const { core } = state;
      const room = repairCap === undefined ? Infinity : repairCap - (core.repairedThisBar ?? 0);
      const repaired = Math.min(core.maxHp - core.hp, effect.coreRepair * power, room);
      if (touches(core, player, effect.radius) && repaired > 0) {
        core.hp += repaired;
        if (repairCap !== undefined) {
          core.repairedThisBar = (core.repairedThisBar ?? 0) + repaired;
        }
        state.events.push({ type: 'coreRepaired', amount: repaired });
      }
      return;
    }
  }
}

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

function takeId(state: SimState): number {
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  return id;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

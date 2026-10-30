import type { OlaEffect } from '../../data/kiffeur';
import { distanceSquared } from '../../shared/vec';
import { hurtEnemy, keepWhere } from '../effects';
import { applyEnemyStatus } from '../enemy-status';
import { applyPlayerBoost } from '../player-boosts';
import type { SkillModule } from './types';
import type { PlayerState, PropState } from '../state';
import type { StepContext } from '../systems/types';
import { ownerOf } from '../props';

export const OLA = 'ola';

export const ola: SkillModule<OlaEffect> = {
  cast({ state, tempo }, player, effect, _input, power) {
    const wave: PropState = {
      id: state.nextEntityId,
      kind: OLA,
      playerId: player.id,
      phase: 'flying',
      x: player.x,
      y: player.y,
      prevX: player.x,
      prevY: player.y,
      vx: 0,
      vy: 0,
      damage: effect.damage * power,
      ticksLeft: effect.beats * tempo.ticksPerBeat,
      hitsLeft: Infinity,
      hitIds: [],
    };
    state.nextEntityId += 1;
    (state.props ??= []).push(wave);
  },

  update(ctx) {
    const { state } = ctx;
    const props = state.props;
    if (props === undefined) {
      return;
    }
    let gone = false;
    for (const prop of props) {
      if (prop.kind === OLA) {
        spread(ctx, prop);
        gone ||= prop.ticksLeft <= 0;
      }
    }
    if (gone) {
      keepWhere(props, (prop) => prop.kind !== OLA || prop.ticksLeft > 0);
      if (props.length === 0) {
        delete state.props;
      }
    }
  },
};

export function olaFront(effect: OlaEffect, ticksPerBeat: number, ticksLeft: number): number {
  const ticks = effect.beats * ticksPerBeat;
  return (effect.reach * (ticks - ticksLeft)) / ticks;
}

function olaOf(ctx: Pick<StepContext, 'content'>, owner: PlayerState): OlaEffect {
  const effect = ctx.content.classes.get(owner.classId)?.skill.effect;
  if (effect?.kind !== 'ola') {
    throw new Error(`player ${String(owner.id)} of class "${owner.classId}" sets off no Ola`);
  }
  return effect;
}

function spread(ctx: StepContext, wave: PropState): void {
  const { state, tempo } = ctx;
  const owner = ownerOf(state, wave);
  const effect = olaOf(ctx, owner);
  const behind = olaFront(effect, tempo.ticksPerBeat, wave.ticksLeft);
  wave.ticksLeft -= 1;
  const front = olaFront(effect, tempo.ticksPerBeat, wave.ticksLeft);
  const hitIds = (wave.hitIds ??= []);
  for (const enemy of state.enemies) {
    const reach = front + enemy.radius;
    if (
      enemy.hp > 0 &&
      !hitIds.includes(enemy.id) &&
      distanceSquared(enemy, wave) <= reach * reach
    ) {
      hitIds.push(enemy.id);
      if (front <= effect.damageReach + enemy.radius) {
        hurtEnemy(state, enemy, wave.damage, wave.playerId, wave);
      }
      applyEnemyStatus(state, enemy, 'slowed', effect.slowBeats * tempo.ticksPerBeat);
    }
  }
  for (const player of state.players) {
    const distance = Math.sqrt(distanceSquared(player, wave));
    if (!player.downed && distance - player.radius <= front && distance + player.radius > behind) {
      applyPlayerBoost(ctx, player, {
        id: OLA,
        modifiers: [
          { stat: 'speedMul', mul: effect.boostMul },
          { stat: 'attackCooldownMul', mul: 1 / effect.boostMul },
          { stat: 'weaponRateMul', mul: effect.boostMul },
        ],
        ticks: effect.boostBars * tempo.ticksPerBar,
      });
    }
  }
}

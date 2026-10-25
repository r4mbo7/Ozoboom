import { isBeatTick } from '../../shared/tempo';
import { touches } from '../effects';
import { type GaugeModule, gaugeValue, setGauge } from '../gauges';
import { applyPlayerBoost } from '../player-boosts';
import type { PlayerState } from '../state';
import type { StepContext } from '../systems/types';
import { auraRadius } from '../attacks/aura';

export const KIFF = 'kiff';

export const kiffGauge: GaugeModule = (ctx, player, gauge, definition) => {
  const { state, content, tempo } = ctx;
  const { attack } = definition;
  if (attack.kind !== 'aura') {
    throw new Error(`class "${definition.id}" has a Kiff but no aura`);
  }
  const { kiff } = attack;
  const radius = auraRadius(player, attack);
  let value = gaugeValue(player);
  for (const event of state.events) {
    if (event.type === 'playerHit' && event.playerId === player.id) {
      value -= event.damage * kiff.perHp;
    } else if (event.type === 'enemyDied' && !player.downed) {
      const chased = {
        x: event.x,
        y: event.y,
        radius: content.enemies.get(event.kind)?.radius ?? 0,
      };
      if (touches(chased, player, radius)) {
        value += kiff.perChase;
      }
    }
  }
  setGauge(player, gauge, value);

  const notches = Math.floor(gaugeValue(player));
  if (player.downed || notches < 1 || !isBeatTick(state.tick, tempo)) {
    return;
  }
  const rate = 1 + notches * kiff.ratePerNotch;
  const ticks = tempo.ticksPerBeat + 1;
  for (const ally of state.players) {
    if (ally.downed || !touches(ally, player, radius)) {
      continue;
    }
    if (cheeredMore(ctx, player, ally, notches)) {
      continue;
    }
    applyPlayerBoost(ctx, ally, {
      id: KIFF,
      modifiers: [
        { stat: 'attackCooldownMul', mul: 1 / rate },
        { stat: 'weaponRateMul', mul: rate },
      ],
      ticks,
    });
  }
};

// An ally in two Kiffeurs' auras keeps the boost of the one with more notches.
function cheeredMore(
  { state, content }: StepContext,
  player: PlayerState,
  ally: PlayerState,
  notches: number,
): boolean {
  return state.players.some((other) => {
    const attack = content.classes.get(other.classId)?.attack;
    return (
      other !== player &&
      !other.downed &&
      attack?.kind === 'aura' &&
      Math.floor(gaugeValue(other)) > notches &&
      touches(ally, other, auraRadius(other, attack))
    );
  });
}

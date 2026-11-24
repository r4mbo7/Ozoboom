import type { PotionRules, SetDefinition } from '../../data/types';
import { isBarTick } from '../../shared/tempo';
import { touches } from '../effects';
import { lookup } from '../lookup';
import { applyPlayerBoost } from '../player-boosts';
import { POTION_BOOST } from '../potion-shield';
import type { BoostModifier, PlayerState } from '../state';
import { applyDerivedStats } from '../stats';
import { freeCarrier, inDrawnPhrase, saltedPhrase, type DrawnPhrase } from './stage-bonus';
import type { StepContext } from './types';

const POTION_TAG = 0x504f5449;

export function potionPhrase(
  seed: number,
  stageStartTick: number,
  set: SetDefinition,
): DrawnPhrase | null {
  const rules = set.potion;
  return rules === undefined
    ? null
    : saltedPhrase(POTION_TAG, rules.chance, seed, stageStartTick, set);
}

export function potionCarriers({ state, set, tempo }: StepContext): void {
  if (set.potion === undefined) {
    return;
  }
  if (
    state.potion === undefined &&
    isBarTick(state.tick, tempo) &&
    inDrawnPhrase(state, set, tempo, potionPhrase)
  ) {
    state.potion = { stage: 'due' };
  }
  if (
    state.potion?.stage !== 'due' ||
    state.bombDue === true ||
    state.twinVibes?.stage === 'due' ||
    state.battery?.stage === 'due'
  ) {
    return;
  }
  const carrier = freeCarrier(state);
  if (carrier !== undefined) {
    carrier.carriesPotion = true;
    state.potion = { stage: 'carried' };
  }
}

export function dropPotion({ state, set }: StepContext, x: number, y: number): void {
  if (set.potion === undefined) {
    return;
  }
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  state.potion = { stage: 'lying', id, x, y };
  state.events.push({ type: 'potionDropped', id, x, y });
}

export function potion(ctx: StepContext): void {
  const { state, set, tempo } = ctx;
  const rules = set.potion;
  const cell = state.potion;
  if (rules === undefined || cell?.stage !== 'lying') {
    return;
  }
  const taker = state.players.find(
    (player) => !player.downed && player.gone !== true && touches(player, cell, rules.radius),
  );
  if (taker === undefined) {
    return;
  }
  applyPlayerBoost(ctx, taker, {
    id: POTION_BOOST,
    modifiers: potionModifiers(rules),
    ticks: rules.bars * tempo.ticksPerBar,
  });
  state.potion = { stage: 'over' };
  state.events.push({ type: 'potionTaken', id: cell.id, playerId: taker.id, x: cell.x, y: cell.y });
}

function potionModifiers({ damageMul, rateMul, speedMul }: PotionRules): BoostModifier[] {
  return [
    { stat: 'speedMul', mul: speedMul },
    { stat: 'damageMul', mul: damageMul },
    { stat: 'attackCooldownMul', mul: 1 / rateMul },
    { stat: 'weaponRateMul', mul: rateMul },
    { stat: 'weaponDamageMul', mul: damageMul },
  ];
}

export function clearPotion({ state, content }: Pick<StepContext, 'state' | 'content'>): void {
  delete state.potion;
  for (const player of state.players) {
    if (dropPotionBoost(player)) {
      applyDerivedStats(player, lookup(content.classes, player.classId, 'class'));
    }
  }
}

function dropPotionBoost(player: PlayerState): boolean {
  const boosts = player.boosts?.filter((boost) => boost.id !== POTION_BOOST);
  if (boosts === undefined || boosts.length === player.boosts?.length) {
    return false;
  }
  if (boosts.length === 0) {
    delete player.boosts;
  } else {
    player.boosts = boosts;
  }
  return true;
}
